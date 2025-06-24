import React, { useState, useEffect } from "react";
import { Mic, MicOff, Upload, HelpCircle, Loader2, CheckCircle2, XCircle, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSpeech } from "@/context/SpeechContext";
import { useChartData } from "@/context/ChartDataContext";
import { useConnection } from "@/context/ConnectionContext";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { motion } from "framer-motion";

const Header = () => {
  const { isListening, startListening, stopListening, recognitionSupported } = useSpeech();
  const { uploadedImageUrl, resetChart } = useChartData();
  const { backend, ollama, models, selectedModel, setSelectedModel, checkConnections } = useConnection();
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const { setTheme } = useTheme();
  
  // Set dark theme on component mount
  useEffect(() => {
    setTheme("dark");
  }, [setTheme]);
  
  const handleMicToggle = async () => {
    if (!recognitionSupported) {
      toast.error('Speech recognition is not supported in this browser');
      return;
    }
    
    if (isListening) {
      stopListening();
      toast.info('Stopped listening');
    } else {
      await startListening();
      toast.success('Listening...');
    }
  };
  
  const handleNewChart = () => {
    if (confirm("Are you sure you want to clear current data and upload a new chart?")) {
      resetChart();
    }
  };

  const handleManualCheck = async () => {
    setIsChecking(true);
    await checkConnections();
    setIsChecking(false);
    
    if (backend && ollama) {
      toast.success('All connections are working properly');
    } else if (!backend) {
      toast.error('Backend connection failed. Start the backend server with "python app.py"');
    } else if (!ollama) {
      toast.error('Ollama connection failed. Make sure Ollama is running with "ollama serve"');
    }
  };
  
  return (
    <motion.header 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="border-b border-border px-6 py-4 bg-background sticky top-0 z-10"
    >
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center">
          <motion.div 
            className="h-10 w-10 mr-3 bg-primary rounded-md flex items-center justify-center"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <span className="text-primary-foreground font-bold text-xl">DE</span>
          </motion.div>
          <h1 className="text-2xl font-bold text-foreground">DataEcho</h1>
        </div>
        
        <div className="flex items-center space-x-3">
          {/* Connection status indicators */}
          <div className="flex items-center gap-4 mr-2">
            <div className="flex items-center gap-1">
              <div className={`w-2.5 h-2.5 rounded-full ${
                backend ? 'bg-green-500' : 'bg-red-500'
              }`}></div>
              <span className="text-xs text-muted-foreground">Backend</span>
            </div>
            
            <div className="flex items-center gap-1">
              <div className={`w-2.5 h-2.5 rounded-full ${
                ollama ? 'bg-green-500' : 'bg-red-500'
              }`}></div>
              <span className="text-xs text-muted-foreground">Ollama</span>
            </div>
          </div>
          
          {/* Theme indicator */}
          <div className="flex items-center gap-1">
            <Moon size={14} className="text-primary" />
            <span className="text-xs text-muted-foreground">Dark</span>
          </div>
          
          {/* Model selector */}
          {ollama && models.length > 0 && (
            <Select value={selectedModel} onValueChange={setSelectedModel}>
              <SelectTrigger className="w-[130px] h-8">
                <SelectValue placeholder="Select model" />
              </SelectTrigger>
              <SelectContent>
                {models.map(model => (
                  <SelectItem key={model} value={model}>{model}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          
          {/* Check connections button */}
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleManualCheck}
            disabled={isChecking}
          >
            {isChecking ? (
              <Loader2 size={14} className="mr-1 animate-spin" />
            ) : (
              backend && ollama ? 
              <CheckCircle2 size={14} className="mr-1 text-green-500" /> : 
              <XCircle size={14} className="mr-1 text-red-500" />
            )}
            <span className="text-xs">{isChecking ? 'Checking...' : 'Check'}</span>
          </Button>
          
          {uploadedImageUrl && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleNewChart}
            >
              <Upload size={16} className="mr-2" /> New Chart
            </Button>
          )}
          
          {recognitionSupported && (
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                variant="outline"
                size="icon"
                onClick={handleMicToggle}
                className={isListening ? "animate-pulse ring-2 ring-primary" : ""}
                title={isListening ? "Stop listening" : "Start listening"}
              >
                {isListening ? (
                  <MicOff className="h-4 w-4 text-destructive" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
              </Button>
            </motion.div>
          )}
          
          <Dialog open={isHelpOpen} onOpenChange={setIsHelpOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon">
                <HelpCircle className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="text-xl">About Chart Whisper</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 text-sm mt-2">
                <p>
                  DataEcho helps you analyze charts through voice or text interaction.
                  Simply upload a chart image, and ask questions about the data.
                </p>
                
                <h3 className="font-semibold">How to use:</h3>
                <ol className="list-decimal pl-5 space-y-1">
                  <li>Upload a chart image</li>
                  <li>Ask questions about the data via voice or text</li>
                  <li>Get instant insights and analysis</li>
                  <li>Use the text-to-speech buttons to hear responses</li>
                </ol>
                
                <h3 className="font-semibold">Voice Interaction:</h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Click the microphone button to start/stop voice recognition</li>
                  <li>Use the microphone button in the chat to ask a specific question</li>
                  <li>Click the speaker button on any response to hear it read aloud</li>
                </ul>
                
                <div className="bg-muted p-3 rounded-md mt-2">
                  <h4 className="font-semibold mb-1">System Requirements:</h4>
                  <p className="text-xs text-muted-foreground">
                    <strong>Backend:</strong> Python Flask server with Pix2Struct<br />
                    <strong>Ollama:</strong> Local LLM server running with models<br />
                    <strong>Voice Features:</strong> Modern browser with SpeechRecognition API
                  </p>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </motion.header>
  );
};

export default Header;
