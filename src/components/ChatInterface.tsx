import React, { useState, useRef, useEffect } from 'react';
import { Send, AlertCircle, Volume2, VolumeX, Mic, MicOff, Loader2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useChartData } from '@/context/ChartDataContext';
import { useConnection } from '@/context/ConnectionContext';
import { askQuestionToBackend } from '@/services/backendService';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface ChatInterfaceProps {
  demoMode?: boolean;
}

// Import this dynamically to avoid issues with missing window in SSR
const useSpeech = () => {
  // Check if speech APIs are available
  const speechSynthesisAvailable = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const recognitionAvailable = typeof window !== 'undefined' && 
    (window.SpeechRecognition || window.webkitSpeechRecognition);
  
  // State
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  
  // Speech synthesis
  const speak = (text: string) => {
    if (!speechSynthesisAvailable) return;
    
    stopSpeaking();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };
  
  const stopSpeaking = () => {
    if (!speechSynthesisAvailable) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  };
  
  // Speech recognition
  const [recognitionCallbacks, setRecognitionCallbacks] = useState<Array<(text: string) => void>>([]);
  
  const startListening = async () => {
    if (!recognitionAvailable) {
      throw new Error('Speech recognition not supported');
    }
    
    try {
      if (isListening) return;
      
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      
      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        recognitionCallbacks.forEach(callback => callback(transcript));
      };
      
      recognition.onend = () => {
        setIsListening(false);
      };
      
      recognition.start();
      setIsListening(true);
    } catch (error) {
      setIsListening(false);
      throw error;
    }
  };
  
  const stopListening = () => {
    setIsListening(false);
  };
  
  const listenForResult = (callback: (text: string) => void) => {
    setRecognitionCallbacks(prev => [...prev, callback]);
    return () => {
      setRecognitionCallbacks(prev => prev.filter(cb => cb !== callback));
    };
  };
  
  return {
    speak,
    stopSpeaking,
    isSpeaking,
    startListening,
    stopListening,
    isListening,
    recognitionSupported: recognitionAvailable,
    listenForResult
  };
};

const ChatInterface: React.FC<ChatInterfaceProps> = ({ demoMode = false }) => {
  const { chartData } = useChartData();
  const { backend, ollama, selectedModel } = useConnection();
  const { 
    speak, 
    stopSpeaking, 
    isSpeaking, 
    startListening, 
    stopListening, 
    isListening, 
    recognitionSupported, 
    listenForResult 
  } = useSpeech();
  
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeSpeechId, setActiveSpeechId] = useState<string | null>(null);
  
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({
        top: scrollAreaRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages]);

  // Set up speech recognition handler
  useEffect(() => {
    // Register speech result handler
    const unsubscribe = listenForResult((text) => {
      if (text.trim()) {
        setQuestion(text);
        // Small delay to show the user what was recognized before submitting
        setTimeout(() => {
          handleSubmit();
        }, 300);
      }
    });
    
    return unsubscribe;
  }, [chartData, backend, ollama, selectedModel, demoMode]); // Re-register when these dependencies change

  // Sample responses for when backend/Ollama is not available
  const SAMPLE_RESPONSES = [
    "Based on the chart data, I can see that sales peaked in May at 1,900 units, showing a 46% increase from January.",
    "Looking at the profit margins, March had the best performance with a profit of 530, which represents about 29% of sales.",
    "The data shows a positive correlation between sales and profit throughout the months, with both metrics generally moving in the same direction.",
    "Customer numbers grew steadily from January to March, then dipped in April before recovering in May. This pattern closely follows the sales trend.",
    "If we analyze the per-customer value, May had the highest average sale per customer at approximately $29.23."
  ];

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    if (!question.trim()) return;
    
    try {
      setIsProcessing(true);
      
      // Stop any ongoing listening or speaking
      if (isListening) {
        stopListening();
      }
      if (isSpeaking) {
        stopSpeaking();
      }
      
      // Add user question to messages
      const userMessage: Message = {
        id: Date.now().toString(),
        role: 'user',
        content: question
      };
      
      setMessages(prev => [...prev, userMessage]);
      setQuestion("");
      
      let answer: string;
      
      if (!chartData) {
        answer = "I don't have any chart data to analyze. Please upload a chart first.";
      } else if (!backend || !ollama || demoMode) {
        // Use sample response if backend/Ollama is not available or in demo mode
        const randomIndex = Math.floor(Math.random() * SAMPLE_RESPONSES.length);
        answer = SAMPLE_RESPONSES[randomIndex];
        
        // Brief delay to simulate processing
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        // Use the API service to ask the question
        console.log("Sending question to Ollama via API");
        
        const response = await askQuestionToBackend(question, {
          title: chartData.title,
          rawText: chartData.rawText
        }, { model: selectedModel });
        
        if (!response || !response.answer) {
          throw new Error("Failed to get answer from Ollama");
        }
        
        answer = response.answer;
      }
      
      // Add assistant response to messages
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: answer
      };
      
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Error processing question:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      
      toast.error(`Failed to process question: ${errorMessage}`);
      
      // Add error message to chat
      const errorAssistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Sorry, I encountered an error: ${errorMessage}`
      };
      
      setMessages(prev => [...prev, errorAssistantMessage]);
    } finally {
      setIsProcessing(false);
      inputRef.current?.focus();
    }
  };

  const handleVoiceInput = async () => {
    if (!recognitionSupported) {
      toast.error('Speech recognition is not supported in this browser');
      return;
    }
    
    if (isListening) {
      stopListening();
    } else {
      try {
        toast.info('Listening for question...');
        await startListening();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        toast.error(`Could not start listening: ${errorMessage}`);
      }
    }
  };
  
  const handleTextToSpeech = (text: string, messageId: string) => {
    if (activeSpeechId === messageId) {
      // Stop speaking if already speaking this message
      stopSpeaking();
      setActiveSpeechId(null);
    } else {
      // Stop any current speech and start new one
      stopSpeaking();
      speak(text);
      setActiveSpeechId(messageId);
    }
  };

  return (
    <div className="flex flex-col h-full p-4">
      <div className="text-lg font-semibold mb-4 flex items-center justify-between">
        <span>Chat with Your Chart</span>
        {recognitionSupported && (
          <div className="text-xs text-muted-foreground">
            {isListening ? "Listening..." : "Ready for voice input"}
          </div>
        )}
      </div>
      
      <div className="flex-1 overflow-hidden relative">
        <ScrollArea className="h-full pr-4" ref={scrollAreaRef}>
          <AnimatePresence>
            {messages.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="flex flex-col items-center justify-center h-full text-center p-6 min-h-[300px]"
              >
                <div className="bg-primary/20 rounded-full p-4 mb-4">
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    width="24" 
                    height="24" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    className="text-primary"
                  >
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                    <path d="M12 17h.01"/>
                  </svg>
                </div>
                
                <h3 className="font-medium text-lg mb-2">Ask about your chart</h3>
                <p className="text-muted-foreground mb-4">
                  Ask questions about the chart data to get insights and analysis
                </p>
                
                <div className="text-sm text-muted-foreground">
                  <p>Try questions like:</p>
                  <ul className="mt-2 space-y-1">
                    <li>"What's the highest value in this chart?"</li>
                    <li>"What trends do you see in this data?"</li>
                    <li>"Compare the first and last month."</li>
                  </ul>
                </div>
                
                {((!backend || !ollama) && !demoMode) && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }} 
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.5 }}
                    className="mt-4 max-w-md"
                  >
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Limited Functionality</AlertTitle>
                      <AlertDescription>
                        {!backend ? 
                          "The backend server is not connected. Sample answers will be provided." : 
                          "Ollama is not available. Sample answers will be provided."}
                      </AlertDescription>
                    </Alert>
                  </motion.div>
                )}
                
                {demoMode && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }} 
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.5 }}
                    className="mt-4 max-w-md"
                  >
                    <Alert variant="default" className="border-primary/20 bg-primary/5">
                      <AlertDescription>
                        Running in demo mode. Sample answers will be provided.
                      </AlertDescription>
                    </Alert>
                  </motion.div>
                )}
              </motion.div>
            ) : (
              <div className="space-y-4 py-4">
                {messages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${message.role === 'assistant' ? 'justify-start' : 'justify-end'}`}
                  >
                    <div
                      className={`relative group ${
                        message.role === 'assistant'
                          ? 'bg-muted p-3 rounded-lg max-w-[85%]'
                          : 'bg-primary text-primary-foreground p-3 rounded-lg max-w-[85%]'
                      }`}
                    >
                      <p className="whitespace-pre-wrap pr-8">{message.content}</p>
                      
                      {/* Text-to-speech button for assistant messages */}
                      {message.role === 'assistant' && (
                        <button
                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full hover:bg-background"
                          onClick={() => handleTextToSpeech(message.content, message.id)}
                          title={activeSpeechId === message.id ? "Stop speaking" : "Speak this message"}
                        >
                          {activeSpeechId === message.id ? 
                            <VolumeX className="h-4 w-4 text-primary" /> : 
                            <Volume2 className="h-4 w-4" />
                          }
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))}
                
                {/* Typing indicator when processing */}
                {isProcessing && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex justify-start"
                  >
                    <div className="bg-muted p-3 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <div className="h-2 w-2 bg-primary rounded-full animate-pulse"></div>
                        <div className="h-2 w-2 bg-primary rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                        <div className="h-2 w-2 bg-primary rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            )}
          </AnimatePresence>
        </ScrollArea>
      </div>

      <form 
        onSubmit={handleSubmit}
        className="mt-4 flex items-center space-x-2"
      >
        <Input
          ref={inputRef}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask about the chart data..."
          disabled={isProcessing || !chartData}
          className="flex-1"
        />
        
        {recognitionSupported && (
          <Button 
            type="button" 
            variant="outline"
            size="icon"
            disabled={isProcessing || !chartData}
            onClick={handleVoiceInput}
            className={isListening ? "bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50" : ""}
            title={isListening ? "Stop listening" : "Ask with voice"}
          >
            {isListening ? 
              <MicOff className="h-4 w-4 text-red-500" /> : 
              <Mic className="h-4 w-4" />
            }
          </Button>
        )}
        
        <Button 
          type="submit" 
          disabled={isProcessing || !question.trim() || !chartData}
          className="transition-all duration-200"
        >
          {isProcessing ? 
            <Loader2 className="h-4 w-4 animate-spin" /> : 
            <Send className="h-4 w-4" />
          }
        </Button>
      </form>
      
      <div className="mt-2 text-xs text-center text-muted-foreground">
        {demoMode ? 
          'Using sample responses (demo mode)' :
          (backend && ollama ? 
            `Using ${selectedModel} model for analysis` : 
            'Using sample responses (backend or Ollama not connected)')}
      </div>
    </div>
  );
};

export default ChatInterface;
