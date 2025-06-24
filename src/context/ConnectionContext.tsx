
import React, { createContext, useState, useContext, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { checkFullStatus, getAvailableModels } from '@/services/backendService';

export interface ConnectionState {
  backend: boolean;
  backendChecking: boolean;
  ollama: boolean;
  ollamaChecking: boolean;
  models: string[];
  lastChecked: number;
  checkConnections: (silent?: boolean) => Promise<void>;
  selectedModel: string;
  setSelectedModel: (model: string) => void;
}

// Create the context with a default value to avoid null checks
const ConnectionContext = createContext<ConnectionState | undefined>(undefined);

// Create a safer initial state
const initialState: ConnectionState = {
  backend: false,
  backendChecking: false,
  ollama: false,
  ollamaChecking: false,
  models: [],
  lastChecked: 0,
  checkConnections: async () => {},
  selectedModel: "llama3",
  setSelectedModel: () => {}
};

// Export the provider component separately
export const ConnectionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [backend, setBackend] = useState<boolean>(false);
  const [backendChecking, setBackendChecking] = useState<boolean>(false);
  const [ollama, setOllama] = useState<boolean>(false);
  const [ollamaChecking, setOllamaChecking] = useState<boolean>(false);
  const [models, setModels] = useState<string[]>([]);
  const [lastChecked, setLastChecked] = useState<number>(0);
  const [selectedModel, setSelectedModel] = useState<string>("llama3");

  // Check connections using our unified API service
  const checkConnectionsHandler = useCallback(async (silent: boolean = false) => {
    try {
      setBackendChecking(true);
      setOllamaChecking(true);
      
      // Get connection status
      const status = await checkFullStatus();
      
      // Update state with the results
      setBackend(status.backend);
      setOllama(status.ollama);
      setLastChecked(Date.now());
      
      // Show message if connections were successful and not in silent mode
      if (!silent) {
        if (status.backend && status.ollama) {
          toast.success("Connected to backend and Ollama");
        } else if (status.backend) {
          toast.warning("Connected to backend but Ollama is not available");
        }
      }
      
      // Update models if available
      if (status.models && status.models.length > 0) {
        setModels(status.models);
        
        // Only update selectedModel if it's not in the available models list
        if (!selectedModel || !status.models.includes(selectedModel)) {
          setSelectedModel(status.models[0]);
        }
      } else if (status.ollama) {
        // If Ollama is connected but no models reported, try to get them directly
        try {
          const directModels = await getAvailableModels();
          if (directModels.length > 0) {
            setModels(directModels);
            if (!selectedModel || !directModels.includes(selectedModel)) {
              setSelectedModel(directModels[0]);
            }
          }
        } catch (error) {
          console.error("Failed to get models directly:", error);
        }
      }
    } catch (error) {
      console.error("Error checking connections:", error);
      if (!silent) {
        toast.error("Failed to check connections");
      }
    } finally {
      setBackendChecking(false);
      setOllamaChecking(false);
    }
  }, [selectedModel]);

  // Initial connection check
  useEffect(() => {
    // Check for fresh values
    checkConnectionsHandler(true);
    
    // Set interval to check connections every 30 seconds
    const interval = setInterval(() => {
      checkConnectionsHandler(true);
    }, 30000);
    
    return () => clearInterval(interval);
  }, [checkConnectionsHandler]);

  const value = {
    backend,
    backendChecking,
    ollama,
    ollamaChecking,
    models,
    lastChecked,
    checkConnections: checkConnectionsHandler,
    selectedModel,
    setSelectedModel
  };

  return (
    <ConnectionContext.Provider value={value}>
      {children}
    </ConnectionContext.Provider>
  );
};

// Define the hook separately from the context and provider
export function useConnection(): ConnectionState {
  const context = useContext(ConnectionContext);
  if (context === undefined) {
    console.error(
      "useConnection hook was called outside of a ConnectionProvider. " +
      "Make sure the component is wrapped in a ConnectionProvider."
    );
    // Return a safe default to prevent runtime errors
    return initialState;
  }
  return context;
}

// Export the context as default
export default ConnectionContext;
