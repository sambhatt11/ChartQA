
import React, { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, CheckCircle, Loader2, RefreshCw } from "lucide-react";
import { testOllamaConnection } from '@/services/backendService';
import { checkConnections } from '@/services/connectionService';
import { toast } from 'sonner';

const OllamaStatusCheck: React.FC = () => {
  const [status, setStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [models, setModels] = useState<string[]>([]);
  const [message, setMessage] = useState<string>('Checking Ollama connection...');
  const [isChecking, setIsChecking] = useState<boolean>(true);

  const checkOllamaStatus = async () => {
    setIsChecking(true);
    setStatus('checking');
    setMessage('Checking Ollama connection...');
    
    try {
      // Check via connection service first
      const connectionStatus = await checkConnections(true, true);
      
      if (connectionStatus.ollama) {
        setStatus('connected');
        setModels(connectionStatus.models);
        setMessage(`Connected to Ollama. ${connectionStatus.models.length} models available.`);
        return;
      }
      
      // If the connection service reports no connection, try direct check
      const result = await testOllamaConnection();
      
      if (result.success) {
        setStatus('connected');
        setModels(result.models || []);
        setMessage(`Connected to Ollama. ${result.models?.length || 0} models available.`);
      } else {
        setStatus('disconnected');
        setMessage(result.message || 'Could not connect to Ollama');
      }
    } catch (error) {
      setStatus('disconnected');
      setMessage(error instanceof Error ? error.message : 'An error occurred while checking Ollama');
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    checkOllamaStatus();
  }, []);

  // Suggestion message based on status
  const getSuggestion = () => {
    if (status === 'disconnected') {
      return (
        <>
          <p className="text-sm mt-2">Make sure:</p>
          <ul className="list-disc text-xs ml-5 mt-1 space-y-1">
            <li>Ollama is installed (visit <a href="https://ollama.ai/download" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">ollama.ai/download</a>)</li>
            <li>Ollama server is running with <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">ollama serve</code></li>
            <li>You have pulled at least one model with <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">ollama pull llama3</code></li>
          </ul>
        </>
      );
    }
    return null;
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          {status === 'checking' ? (
            <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
          ) : status === 'connected' ? (
            <CheckCircle className="h-5 w-5 text-green-500" />
          ) : (
            <AlertCircle className="h-5 w-5 text-red-500" />
          )}
          Ollama Connection Status
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm mb-2">{message}</p>
        
        {status === 'connected' && models.length > 0 && (
          <div className="mt-2">
            <p className="text-sm font-medium">Available models:</p>
            <div className="flex flex-wrap gap-2 mt-1">
              {models.map((model, index) => (
                <span key={index} className="px-2 py-1 bg-gray-100 text-xs rounded">
                  {model}
                </span>
              ))}
            </div>
          </div>
        )}
        
        {getSuggestion()}
      </CardContent>
      <CardFooter>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={checkOllamaStatus} 
          disabled={isChecking}
          className="w-full"
        >
          {isChecking ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
              <span>Checking...</span>
            </>
          ) : (
            <>
              <RefreshCw className="h-3 w-3 mr-1" />
              <span>Check Again</span>
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default OllamaStatusCheck;
