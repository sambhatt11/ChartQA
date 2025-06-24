
import React, { useState, useEffect } from "react";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ConnectionProvider } from "./context/ConnectionContext";
import { ChartDataProvider } from "./context/ChartDataContext";
import { SpeechProvider } from "./context/SpeechContext";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import Header from "./components/Header";
import ChartAnalysis from "./components/ChartAnalysis";
import { motion, AnimatePresence } from "framer-motion";

const App = () => {
  const [isInitializing, setIsInitializing] = useState(true);

  // Simulate initial loading
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitializing(false);
    }, 1000);
    
    return () => clearTimeout(timer);
  }, []);

  return (
    <TooltipProvider>
      {/* Ensure ConnectionProvider is the outermost context provider */}
      <ConnectionProvider>
        <ChartDataProvider>
          <SpeechProvider>
            <div className="min-h-screen flex flex-col bg-background">
              <Toaster richColors position="top-right" />
              
              {/* Initial loading animation */}
              <AnimatePresence>
                {isInitializing && (
                  <motion.div 
                    className="fixed inset-0 flex items-center justify-center bg-background z-50"
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5 }}
                  >
                    <motion.div 
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 1.2, opacity: 0 }}
                      transition={{ duration: 0.5 }}
                      className="flex flex-col items-center"
                    >
                      <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
                      <h1 className="text-2xl font-bold text-primary">DataEcho</h1>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              <Header />
              
              <main className="flex-1 container mx-auto p-4 overflow-hidden">
                <AspectRatio ratio={16/9} className="h-full max-h-[calc(100vh-10rem)] overflow-hidden">
                  <ChartAnalysis />
                </AspectRatio>
              </main>
            </div>
          </SpeechProvider>
        </ChartDataProvider>
      </ConnectionProvider>
    </TooltipProvider>
  );
};

export default App;
