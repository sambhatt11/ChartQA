import React, { useState, useEffect, useRef } from 'react';
import { Send, Loader2, Mic, StopCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea'; 
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useConnection } from '@/context/ConnectionContext';
import { useSpeech } from '@/context/SpeechContext';
import { motion, AnimatePresence } from 'framer-motion';
import { askOllama } from '@/services/api/ollamaService';
import { toast } from 'sonner';

declare global {
  interface Window {
    __chartImageUrl?: string;
  }
}

interface OllamaChatProps {
  chartData: any;
  demoMode?: boolean;
}

const OllamaChat: React.FC<OllamaChatProps> = ({ chartData, demoMode = false }) => {
  const [messages, setMessages] = useState<Array<{role: string; content: string}>>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { ollama, selectedModel } = useConnection();
  const { isListening, startListening, stopListening, listenForResult } = useSpeech();
  const [transcript, setTranscript] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isImageProcessing, setIsImageProcessing] = useState(false);

  const convertImageToBase64 = async (imageUrl: string): Promise<string | null> => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = reader.result as string;
          const base64Data = base64.split(',')[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error("Error converting image to base64:", error);
      return null;
    }
  };

  useEffect(() => {
    const unsubscribe = listenForResult((text) => {
      setTranscript(text);
    });
    
    return unsubscribe;
  }, [listenForResult]);

  useEffect(() => {
    if (transcript) {
      setInput(transcript);
    }
  }, [transcript]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    setMessages([{
      role: 'assistant',
      content: 'Hello! I can analyze your chart data. What would you like to know?'
    }]);
  }, [chartData]);

  const resetTranscript = () => {
    setTranscript('');
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    setMessages(prev => [...prev, { role: 'user', content: input }]);
    
    const userQuestion = input;
    setInput('');
    setIsLoading(true);
    setError(null);
    
    if (isListening) {
      stopListening();
      resetTranscript();
    }

    try {
      const isMultimodal = selectedModel.toLowerCase().includes('llava') || 
                          selectedModel.toLowerCase().includes('cogvlm') ||
                          selectedModel.toLowerCase().includes('bakllava');
      let imageBase64: string | null = null;
      
      if (isMultimodal && window.__chartImageUrl) {
        console.log("Preparing image for multimodal analysis");
        setIsImageProcessing(true);
        try {
          imageBase64 = await convertImageToBase64(window.__chartImageUrl);
          if (imageBase64) {
            toast.info(`Including chart image in ${selectedModel} analysis. This may take longer.`);
          }
        } catch (imageError) {
          console.error("Error preparing image:", imageError);
          toast.error("Could not process image. Using text-only analysis.");
        }
        setIsImageProcessing(false);
      }
      
      if (!chartData) {
        console.error("No chart data available for analysis");
        toast.error("No chart data available. Please upload a chart first.");
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: "I don't see any chart data to analyze. Please upload a chart image first."
        }]);
        setIsLoading(false);
        return;
      }
      
      console.log("Chart data provided to OllamaChat:", chartData);
      
      const chartContext = chartData ? 
        `Title: ${chartData.title || 'Chart'}\n` +
        `Data: ${chartData.rawText || JSON.stringify(chartData.data)}` : 
        'No chart data available';
      
      const prompt = `
${chartContext}

Question: ${userQuestion}

Please provide a detailed answer based only on the chart data provided.`;
      
      console.log("Sending to Ollama API with prompt:", prompt);
      console.log("Including image:", !!imageBase64);
      console.log("Using model:", selectedModel);
      console.log("Demo mode:", demoMode);
      
      if (isMultimodal && !window.__chartImageUrl && !demoMode) {
        toast.warning("Using multimodal model but no image is available. Upload a chart image for visual analysis.");
      }
      
      const useExtendedTimeout = isMultimodal;
      
      try {
        const response = await askOllama(prompt, selectedModel, imageBase64, demoMode, useExtendedTimeout);
        console.log("Ollama API response:", response);
        
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: response
        }]);
      } catch (ollamaError) {
        console.error("Ollama API error:", ollamaError);
        
        const errorMessage = ollamaError instanceof Error ? ollamaError.message : String(ollamaError);
        if (errorMessage.includes("timed out") && isMultimodal) {
          toast.error("LLaVA model timed out. The first request with a new image can take 2-3 minutes. Try again or use demo mode.", 
            { duration: 8000 });
          
          setMessages(prev => [...prev, { 
            role: 'assistant', 
            content: "The LLaVA model timed out. This is common when processing images, especially on the first request. You can try again or enable demo mode from the status panel." 
          }]);
          
          if (!demoMode) {
            const useDemoMode = window.confirm("Would you like to use demo mode instead? (Click OK to use demo mode)");
            if (useDemoMode) {
              try {
                const fallbackResponse = await askOllama(prompt, selectedModel, imageBase64, true);
                setMessages(prev => [...prev, { 
                  role: 'assistant', 
                  content: fallbackResponse
                }]);
              } catch (demoError) {
                console.error("Demo mode error:", demoError);
                setError(`Error in demo mode: ${demoError instanceof Error ? demoError.message : 'Failed to get response'}`);
              }
            }
          }
        } else if (!demoMode) {
          toast.error("Connection to Ollama failed. Using demo mode instead.");
          const fallbackResponse = await askOllama(prompt, selectedModel, imageBase64, true);
          setMessages(prev => [...prev, { 
            role: 'assistant', 
            content: fallbackResponse
          }]);
        } else {
          throw new Error(errorMessage);
        }
      }
      
    } catch (err) {
      console.error("Error in Ollama chat:", err);
      setError(`Error: ${err instanceof Error ? err.message : 'Failed to get response'}`);
      
      toast.error("Could not get a response. Please try again or enable demo mode.");
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: "I'm sorry, I couldn't analyze the chart data at this time. Please try again or check your connection settings." 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading) handleSend();
    }
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      resetTranscript();
      startListening();
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] px-4 py-2 rounded-lg ${
                message.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted'
              }`}
            >
              {message.content}
            </div>
          </motion.div>
        ))}
        
        {(isLoading || isImageProcessing) && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-start"
          >
            <div className="bg-muted max-w-[80%] px-4 py-3 rounded-lg flex items-center space-x-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">
                {isImageProcessing 
                  ? "Processing image for analysis..." 
                  : selectedModel.toLowerCase().includes('llava')
                    ? "Analyzing with LLaVA (may take a minute)..."
                    : "Analyzing chart data..."}
              </span>
            </div>
          </motion.div>
        )}
        
        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        <div ref={bottomRef} />
      </div>
      
      <div className="border-t p-4">
        <div className="flex space-x-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about the chart data..."
            className="flex-1 resize-none"
            disabled={isLoading || isImageProcessing}
          />
          <div className="flex flex-col space-y-2">
            <Button
              size="icon"
              disabled={isLoading || isImageProcessing || !input.trim()}
              onClick={handleSend}
            >
              <Send className="h-4 w-4" />
            </Button>
            
            <Button
              size="icon"
              variant="outline"
              onClick={toggleListening}
              disabled={isLoading || isImageProcessing}
              className={isListening ? 'bg-red-100 text-red-600 border-red-200' : ''}
            >
              {isListening ? (
                <StopCircle className="h-4 w-4" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
        
        <AnimatePresence>
          {isListening && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-2 text-sm text-muted-foreground"
            >
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <p>Listening... Say something about the chart</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {chartData ? null : (
          <div className="mt-3 text-xs text-red-500 bg-red-50 dark:bg-red-900/30 p-2 rounded flex items-center gap-2">
            <AlertCircle className="h-3 w-3" />
            <span>No chart data available. Please upload a chart first.</span>
          </div>
        )}

        {selectedModel.toLowerCase().includes('llava') && (
          <div className="mt-3 text-xs text-muted-foreground bg-amber-50 dark:bg-amber-950/30 p-2 rounded flex items-center gap-2">
            <AlertCircle className="h-3 w-3 text-amber-500" />
            <span>Using LLaVA model for image analysis - first request may take 2-3 minutes</span>
          </div>
        )}

        {demoMode && (
          <div className="mt-3 text-xs text-muted-foreground bg-muted p-2 rounded flex items-center gap-2">
            <AlertCircle className="h-3 w-3" />
            <span>Running in demo mode - responses are generated without using Ollama</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default OllamaChat;
