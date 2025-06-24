
import { useState, useEffect } from "react";
import { checkBackendStatus, getAvailableModels } from "@/services/backendService";
import { AlertCircle, CheckCircle2, RefreshCw } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";

const StatusIndicator = () => {
  const [backendStatus, setBackendStatus] = useState<boolean | null>(null);
  const [models, setModels] = useState<string[]>([]);
  const [isChecking, setIsChecking] = useState(true);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const checkStatus = async () => {
    try {
      setIsChecking(true);
      const status = await checkBackendStatus();
      setBackendStatus(status);
      setLastChecked(new Date());
      
      if (status) {
        const availableModels = await getAvailableModels();
        setModels(availableModels);
      }
    } catch (error) {
      console.error("Error checking backend status:", error);
      setBackendStatus(false);
    } finally {
      setIsChecking(false);
    }
  };
  
  useEffect(() => {
    checkStatus();
    
    // Check status every 30 seconds
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 px-2 rounded-full flex items-center gap-1.5"
            onClick={checkStatus}
          >
            {isChecking ? (
              <RefreshCw className="h-4 w-4 animate-spin text-amber-500" />
            ) : backendStatus ? (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-500" />
            )}
            <span className="text-xs">
              {isChecking ? "Checking..." : backendStatus ? "Backend Online" : "Backend Offline"}
            </span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="w-64 p-4">
          {isChecking ? (
            <p>Checking backend status...</p>
          ) : backendStatus ? (
            <div>
              <p className="font-semibold text-green-600">Backend is running</p>
              {models.length > 0 ? (
                <div className="mt-1">
                  <p className="text-sm">Available Ollama models:</p>
                  <ul className="text-xs list-disc pl-4 mt-1">
                    {models.map((model, idx) => (
                      <li key={idx}>{model}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-xs mt-1 text-amber-600">
                  No Ollama models detected. Please start Ollama and pull a model (e.g., 'ollama pull llama3')
                </p>
              )}
            </div>
          ) : (
            <div>
              <p className="font-semibold text-red-600">Backend is not running</p>
              <p className="text-xs mt-1">Using fallback sample responses</p>
              <div className="mt-2 text-xs space-y-1">
                <p className="font-medium">To start the backend:</p>
                <ol className="list-decimal pl-4">
                  <li>Navigate to the backend folder</li>
                  <li>Run <code className="bg-gray-100 px-1 rounded">python app.py</code></li>
                </ol>
              </div>
              <div className="mt-2 text-xs space-y-1">
                <p className="font-medium">To use Ollama:</p>
                <ol className="list-decimal pl-4">
                  <li>Install Ollama from ollama.ai</li>
                  <li>Start Ollama with <code className="bg-gray-100 px-1 rounded">ollama serve</code></li>
                  <li>Pull a model with <code className="bg-gray-100 px-1 rounded">ollama pull llama3</code></li>
                </ol>
              </div>
            </div>
          )}
          {lastChecked && (
            <p className="text-xs text-gray-500 mt-2">
              Last checked: {lastChecked.toLocaleTimeString()}
            </p>
          )}
          <div className="mt-2 pt-2 border-t border-gray-200">
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full text-xs" 
              onClick={checkStatus}
              disabled={isChecking}
            >
              {isChecking ? "Checking..." : "Refresh Status"}
            </Button>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default StatusIndicator;
