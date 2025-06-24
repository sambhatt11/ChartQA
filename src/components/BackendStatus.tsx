
import { useEffect, useState } from 'react';
import { checkBackendStatus } from '@/services/backendService';
import { AlertCircle, CheckCircle, RefreshCw, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';

interface BackendStatusProps {
  onDemoModeToggle?: (enabled: boolean) => void;
  demoMode?: boolean;
}

const BackendStatus = ({ onDemoModeToggle, demoMode = false }: BackendStatusProps) => {
  const [status, setStatus] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  
  const checkStatus = async () => {
    try {
      setChecking(true);
      const available = await checkBackendStatus();
      setStatus(available);
      
      // If backend becomes unavailable and we're not in demo mode, suggest enabling it
      if (!available && !demoMode && onDemoModeToggle) {
        toast.info("Backend is unavailable. Enable demo mode for a better experience.", {
          action: {
            label: "Enable Demo Mode",
            onClick: () => onDemoModeToggle(true)
          },
          duration: 8000
        });
      }
    } catch (error) {
      console.error("Error checking backend status:", error);
      setStatus(false);
    } finally {
      setChecking(false);
    }
  };
  
  useEffect(() => {
    checkStatus();
    // Check status every 60 seconds
    const interval = setInterval(checkStatus, 60000);
    return () => clearInterval(interval);
  }, []);
  
  return (
    <div className="flex items-center space-x-2">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center">
              {demoMode ? (
                <AlertTriangle className="h-4 w-4 text-amber-500" />
              ) : status === null ? (
                <AlertCircle className="h-4 w-4 text-muted-foreground animate-pulse" />
              ) : status ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <AlertCircle className="h-4 w-4 text-red-500" />
              )}
              <span className="ml-2 text-xs text-muted-foreground">
                {demoMode ? 
                  'Demo Mode' : 
                  `Backend: ${status === null ? 'Checking...' : status ? 'Connected' : 'Disconnected'}`
                }
              </span>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6 ml-1" 
                onClick={checkStatus}
                disabled={checking || demoMode}
              >
                <RefreshCw className={`h-3 w-3 ${checking ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>
              {demoMode 
                ? 'Running in demo mode with sample data - no backend required' 
                : status 
                  ? 'Backend is connected and ready to analyze charts' 
                  : 'Backend is disconnected. Sample data will be used instead.'}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
};

export default BackendStatus;
