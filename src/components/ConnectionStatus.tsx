
import React, { useState, useEffect } from 'react';
import { checkConnections, getCachedStatus } from '@/services/connectionService';
import { motion } from 'framer-motion';
import { AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ConnectionStatusProps {
  compact?: boolean;
  showRefreshButton?: boolean;
  autoCheck?: boolean;
  checkInterval?: number;
}

const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  compact = false,
  showRefreshButton = true,
  autoCheck = true,
  checkInterval = 30000,
}) => {
  const [status, setStatus] = useState(getCachedStatus());
  const [checking, setChecking] = useState(false);
  
  const checkStatus = async (showToasts = false) => {
    try {
      setChecking(true);
      const result = await checkConnections(showToasts, true);
      setStatus(result);
    } catch (error) {
      console.error("Error checking status:", error);
    } finally {
      setChecking(false);
    }
  };
  
  useEffect(() => {
    if (autoCheck) {
      checkStatus();
      const interval = setInterval(() => checkStatus(), checkInterval);
      return () => clearInterval(interval);
    }
  }, [autoCheck, checkInterval]);
  
  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1">
              <motion.div 
                animate={{ scale: checking ? [1, 1.1, 1] : 1 }}
                transition={{ repeat: checking ? Infinity : 0, duration: 1 }}
              >
                {status.backend && status.ollama ? (
                  <CheckCircle size={16} className="text-green-500" />
                ) : (
                  <AlertCircle size={16} className="text-red-500" />
                )}
              </motion.div>
              {showRefreshButton && (
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="h-6 w-6" 
                  onClick={() => checkStatus(true)}
                  disabled={checking}
                >
                  <RefreshCw 
                    size={12} 
                    className={`${checking ? 'animate-spin' : ''}`} 
                  />
                </Button>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{status.statusMessage}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Connection Status</h3>
        {showRefreshButton && (
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => checkStatus(true)}
            disabled={checking}
            className="h-7 px-2"
          >
            <RefreshCw 
              size={12} 
              className={`mr-1 ${checking ? 'animate-spin' : ''}`} 
            />
            <span className="text-xs">{checking ? 'Checking...' : 'Refresh'}</span>
          </Button>
        )}
      </div>
      
      <div className="space-y-1.5">
        <div className="flex items-center">
          <motion.div 
            animate={{ 
              backgroundColor: status.backend 
                ? '#10b981' // green-500
                : '#ef4444'  // red-500
            }}
            className="w-2 h-2 rounded-full mr-2"
          />
          <span className="text-sm">Backend</span>
        </div>
        
        <div className="flex items-center">
          <motion.div 
            animate={{ 
              backgroundColor: status.ollama 
                ? '#10b981' // green-500
                : '#ef4444'  // red-500
            }}
            className="w-2 h-2 rounded-full mr-2"
          />
          <span className="text-sm">Ollama</span>
        </div>
        
        {status.models.length > 0 && (
          <div className="text-xs text-muted-foreground pl-4">
            {status.models.length} models available
          </div>
        )}
      </div>
      
      <p className="text-xs text-muted-foreground">
        {status.statusMessage}
      </p>
    </div>
  );
};

export default ConnectionStatus;
