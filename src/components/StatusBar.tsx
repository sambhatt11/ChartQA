
import React from 'react';
import { useConnection } from '@/context/ConnectionContext';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';

const StatusBar: React.FC = () => {
  const { backend, ollama, selectedModel, backendChecking, ollamaChecking } = useConnection();
  
  // Determine if any connection check is in progress
  const isCheckingConnection = backendChecking || ollamaChecking;
  
  return (
    <div className="flex items-center justify-end gap-3 px-4 py-1 bg-muted/30 text-xs border-b">
      <div className="flex items-center gap-1">
        <div className={`w-2 h-2 rounded-full ${
          backend ? 'bg-green-500' : 'bg-red-500'
        }`} />
        <span>Backend</span>
      </div>
      
      <div className="flex items-center gap-1">
        <div className={`w-2 h-2 rounded-full ${
          ollama ? 'bg-green-500' : 'bg-red-500'
        }`} />
        <span>Ollama</span>
      </div>
      
      {ollama && selectedModel && (
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground">Model:</span>
          <span className="font-medium">{selectedModel}</span>
        </div>
      )}
      
      {isCheckingConnection && (
        <div className="flex items-center gap-1 text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Checking connections...</span>
        </div>
      )}
    </div>
  );
};

export default StatusBar;
