
import React, { createContext, useState, useContext, useCallback, useEffect } from 'react';

interface SpeechContextState {
  isSpeaking: boolean;
  isListening: boolean;
  recognitionSupported: boolean; // Add recognitionSupported property
  stopSpeaking: () => void;
  speak: (text: string) => void;
  startListening: () => Promise<void>;
  stopListening: () => void;
  listenForResult: (callback: (text: string) => void) => () => void;
}

const SpeechContext = createContext<SpeechContextState | undefined>(undefined);

export const SpeechProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Check if speech APIs are available on client side
  const [browserSupport, setBrowserSupport] = useState({
    speechSynthesis: false,
    speechRecognition: false
  });
  
  // Speech states
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [recognitionCallbacks, setRecognitionCallbacks] = useState<Array<(text: string) => void>>([]);
  
  // Detect browser support for speech APIs
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setBrowserSupport({
        speechSynthesis: 'speechSynthesis' in window,
        speechRecognition: !!(window.SpeechRecognition || window.webkitSpeechRecognition)
      });
    }
  }, []);
  
  // Speech synthesis methods
  const speak = useCallback((text: string) => {
    if (!browserSupport.speechSynthesis) return;
    
    // Cancel any ongoing speech
    stopSpeaking();
    
    // Create new utterance
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    
    // Start speaking
    window.speechSynthesis.speak(utterance);
  }, [browserSupport.speechSynthesis]);
  
  const stopSpeaking = useCallback(() => {
    if (!browserSupport.speechSynthesis) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, [browserSupport.speechSynthesis]);
  
  // Speech recognition methods
  const startListening = useCallback(async () => {
    if (!browserSupport.speechRecognition) {
      throw new Error('Speech recognition is not supported in this browser');
    }
    
    if (isListening) return;
    
    try {
      // Create speech recognition
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      
      // Configure
      recognition.continuous = false;
      recognition.interimResults = false;
      
      // Set up event handlers
      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        recognitionCallbacks.forEach(callback => callback(transcript));
      };
      
      recognition.onend = () => {
        setIsListening(false);
      };
      
      recognition.onerror = () => {
        setIsListening(false);
      };
      
      // Start listening
      recognition.start();
      setIsListening(true);
    } catch (error) {
      console.error('Error starting speech recognition:', error);
      setIsListening(false);
      throw error;
    }
  }, [browserSupport.speechRecognition, isListening, recognitionCallbacks]);
  
  const stopListening = useCallback(() => {
    setIsListening(false);
  }, []);
  
  const listenForResult = useCallback((callback: (text: string) => void) => {
    setRecognitionCallbacks(prev => [...prev, callback]);
    
    // Return cleanup function
    return () => {
      setRecognitionCallbacks(prev => prev.filter(cb => cb !== callback));
    };
  }, []);
  
  // Context value
  const value = {
    isSpeaking,
    isListening,
    recognitionSupported: browserSupport.speechRecognition, // Expose recognitionSupported
    speak,
    stopSpeaking,
    startListening,
    stopListening,
    listenForResult
  };
  
  return (
    <SpeechContext.Provider value={value}>
      {children}
    </SpeechContext.Provider>
  );
};

export function useSpeech(): SpeechContextState {
  const context = useContext(SpeechContext);
  
  if (context === undefined) {
    throw new Error('useSpeech must be used within a SpeechProvider');
  }
  
  return context;
}
