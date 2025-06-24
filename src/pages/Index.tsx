
import { useEffect } from "react";
import Header from "@/components/Header";
import ChartAnalysis from "@/components/ChartAnalysis";
import useChartStore from "@/store/chartStore";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ChartDataProvider } from '@/context/ChartDataContext';
import { ConnectionProvider } from '@/context/ConnectionContext';
import { SpeechProvider } from '@/context/SpeechContext';

const Index = () => {
  const { extractionError, clearAll } = useChartStore();
  
  // Add alert if browser doesn't support required APIs
  useEffect(() => {
    // Check if running in browser environment
    if (typeof window !== 'undefined') {
      const unsupportedFeatures = [];
      
      // Check FileReader API (for image uploads)
      if (!window.FileReader) {
        unsupportedFeatures.push("FileReader API");
      }
      
      // Check SpeechSynthesis API (for text-to-speech)
      if (!window.speechSynthesis) {
        unsupportedFeatures.push("Speech Synthesis API");
      }
      
      // Check SpeechRecognition API (for speech-to-text)
      if (!window.SpeechRecognition && !window.webkitSpeechRecognition) {
        unsupportedFeatures.push("Speech Recognition API");
      }
      
      // Alert if there are unsupportedFeatures
      if (unsupportedFeatures.length > 0) {
        alert(`Your browser doesn't support some required features: ${unsupportedFeatures.join(", ")}. Some functionality may be limited.`);
      }
    }
  }, []);

  return (
    <div className="flex flex-col h-screen bg-background">
      <ConnectionProvider>
        <ChartDataProvider>
          <SpeechProvider>
            <Header />
            
            <main className="flex flex-1 overflow-hidden">
              {extractionError ? (
                <div className="w-full p-8 flex flex-col items-center justify-center">
                  <Alert variant="destructive" className="max-w-md">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error Processing Chart</AlertTitle>
                    <AlertDescription>
                      {extractionError}
                    </AlertDescription>
                  </Alert>
                  <Button 
                    variant="outline" 
                    className="mt-4" 
                    onClick={() => clearAll()}
                  >
                    Try Again
                  </Button>
                </div>
              ) : (
                <ChartAnalysis />
              )}
            </main>
          </SpeechProvider>
        </ChartDataProvider>
      </ConnectionProvider>
    </div>
  );
};

export default Index;
