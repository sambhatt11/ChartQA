
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Activity, AlertTriangle, AlertCircle } from "lucide-react";
import StatusDashboard from "./StatusDashboard";
import { checkBackendStatus, checkFullStatus, testOllamaConnection } from "@/services/backendService";
import { toast } from "sonner";

const StatusButton = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [backendStatus, setBackendStatus] = useState<boolean | null>(null);
  const [ollamaStatus, setOllamaStatus] = useState<boolean | null>(null);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  
  // Using useCallback to prevent unnecessary re-renders
  const checkStatuses = useCallback(async () => {
    try {
      if (isCheckingStatus) return; // Prevent multiple simultaneous checks
      
      setIsCheckingStatus(true);
      setStatusMessage("Checking system status...");
      
      console.log("StatusButton: Checking system statuses...");
      
      // First check if backend is running with increased timeout
      const isBackendRunning = await checkBackendStatus();
      setBackendStatus(isBackendRunning);
      
      if (!isBackendRunning) {
        console.log("StatusButton: Backend is not running");
        setOllamaStatus(false);
        setStatusMessage("Backend server is not running. Start it with 'python app.py'");
        return;
      }
      
      // Multiple attempts for Ollama status
      let ollamaConnected = false;
      let attempts = 0;
      const maxAttempts = 2;
      
      while (!ollamaConnected && attempts < maxAttempts) {
        attempts++;
        try {
          // Use the full-status endpoint
          const fullStatus = await checkFullStatus();
          setBackendStatus(fullStatus.backend);
          setOllamaStatus(fullStatus.ollama);
          
          if (fullStatus.models && fullStatus.models.length > 0) {
            setAvailableModels(fullStatus.models);
            ollamaConnected = true;
          }
          
          // If Ollama status is false, do a direct test
          if (!fullStatus.ollama) {
            console.log("StatusButton: Ollama reported as not available, trying direct test");
            const ollamaTest = await testOllamaConnection();
            console.log("StatusButton: Ollama direct test result:", ollamaTest);
            
            if (ollamaTest.success) {
              setOllamaStatus(true);
              setStatusMessage("Ollama is available but status endpoint reports issues");
              ollamaConnected = true;
            } else {
              setStatusMessage(`Ollama issue: ${ollamaTest.message}`);
            }
          } else {
            ollamaConnected = true;
            setStatusMessage(null);
          }
          
          if (ollamaConnected) break;
          
        } catch (error) {
          console.error(`Attempt ${attempts} - Error checking full status:`, error);
          
          if (attempts < maxAttempts) {
            console.log(`Retrying Ollama status check - attempt ${attempts + 1}/${maxAttempts}`);
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }
      
      // If still not connected after all attempts, try direct Ollama test as fallback
      if (!ollamaConnected) {
        try {
          console.log("StatusButton: Trying direct Ollama test as last resort");
          const ollamaTest = await testOllamaConnection();
          setOllamaStatus(ollamaTest.success);
          if (!ollamaTest.success) {
            setStatusMessage(`Ollama connection issue: ${ollamaTest.message}`);
          } else {
            setStatusMessage("Ollama is available but status reporting has issues");
          }
        } catch (innerError) {
          console.error("Error in direct Ollama test:", innerError);
          setOllamaStatus(false);
          setStatusMessage("Could not connect to Ollama service. Start it with 'ollama serve'");
        }
      }
      
      console.log(`StatusButton: Statuses updated - Backend: ${backendStatus}, Ollama: ${ollamaStatus}, Models: ${availableModels.length}`);
    } catch (error) {
      console.error("Error checking statuses:", error);
      setBackendStatus(false);
      setOllamaStatus(false);
      setStatusMessage("Error checking system status");
    } finally {
      setIsCheckingStatus(false);
    }
  }, [isCheckingStatus]);
  
  // Initial check and periodic check
  useEffect(() => {
    checkStatuses();
    
    // Check status every 30 seconds
    const intervalId = setInterval(checkStatuses, 30000);
    
    return () => {
      clearInterval(intervalId);
    };
  }, [checkStatuses]);
  
  // Get button color based on status
  const getButtonVariant = () => {
    if (backendStatus === null) return "outline";
    if (!backendStatus) return "destructive";
    if (!ollamaStatus) return "warning";
    return "outline";
  };
  
  // Get status icon based on backend and Ollama status
  const StatusIcon = () => {
    if (isCheckingStatus) return <Activity className="h-4 w-4 animate-spin" />;
    if (!backendStatus) return <AlertCircle className="h-4 w-4 text-destructive" />;
    if (!ollamaStatus) return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    return <Activity className="h-4 w-4" />;
  };
  
  const handleButtonClick = () => {
    checkStatuses();
    setIsOpen(true);
    
    // If Ollama is not connected, show a toast
    if (backendStatus && !ollamaStatus) {
      toast.warning("Ollama is not connected. Make sure Ollama is running with 'ollama serve'", {
        duration: 6000,
        action: {
          label: "Learn More",
          onClick: () => window.open("https://ollama.com/download", "_blank")
        }
      });
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          variant={getButtonVariant() as any}
          size="sm" 
          className="gap-1.5"
          onClick={handleButtonClick}
          onMouseEnter={checkStatuses}
          title={statusMessage || "System Status"}
        >
          <StatusIcon />
          <span>Status</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="p-0 border-none bg-transparent shadow-none">
        <StatusDashboard 
          onClose={() => setIsOpen(false)} 
          backendStatus={backendStatus}
          ollamaStatus={ollamaStatus}
          availableModels={availableModels}
          onRefresh={checkStatuses}
          statusMessage={statusMessage}
        />
      </DialogContent>
    </Dialog>
  );
};

export default StatusButton;
