
// Manage connection status caching for backend and Ollama services
import { checkFullStatus, testOllamaConnection } from './backendService';
import { toast } from 'sonner';

// Connection status cache
const statusCache = {
  timestamp: 0,
  backend: false,
  ollama: false,
  models: [] as string[],
  statusMessage: 'Not checked yet',
};

// Cache duration in milliseconds
const CACHE_DURATION = 15000; // 15 seconds - reduced to check more frequently

export const checkConnections = async (silent = false, force = false) => {
  const now = Date.now();
  
  // Use cached data if fresh and not forced to update
  if (!force && now - statusCache.timestamp < CACHE_DURATION) {
    return {
      ...statusCache,
      lastChecked: statusCache.timestamp,
    };
  }
  
  try {
    console.log("Checking connections to backend and Ollama...");
    
    // Check backend and Ollama status with a combined check
    const result = await checkFullStatus();
    
    console.log("Connection check results:", result);
    
    // If backend is available but Ollama reports as unavailable, try direct connection
    if (result.backend && !result.ollama) {
      console.log("Backend available but Ollama reported as unavailable. Trying direct connection...");
      try {
        const ollamaTest = await testOllamaConnection();
        if (ollamaTest.success) {
          console.log("Direct Ollama connection successful!");
          result.ollama = true;
          // Try to get models list
          if (ollamaTest.models) {
            result.models = ollamaTest.models;
          }
        }
      } catch (error) {
        console.error("Error checking direct Ollama connection:", error);
      }
    }
    
    // Build status message
    let statusMessage = '';
    if (result.backend && result.ollama) {
      statusMessage = 'Connected to backend and Ollama';
      if (!silent) toast.success('Connected to backend and Ollama');
    } else if (result.backend) {
      statusMessage = 'Connected to backend but not to Ollama';
      if (!silent) toast.warning('Connected to backend but Ollama is not available. Make sure Ollama is running with "ollama serve"');
    } else {
      statusMessage = 'Backend unavailable';
      if (!silent) toast.error('Backend is not available. Start the Flask backend with "python app.py"');
    }
    
    // Update cache
    statusCache.timestamp = now;
    statusCache.backend = result.backend || false;
    statusCache.ollama = result.ollama || false;
    statusCache.models = result.models || [];
    statusCache.statusMessage = statusMessage;
    
    return {
      ...statusCache,
      lastChecked: now,
    };
  } catch (error) {
    console.error("Error checking connections:", error);
    
    // Try direct connection to Ollama as fallback
    try {
      console.log("Trying direct Ollama connection after error...");
      const ollamaTest = await testOllamaConnection();
      if (ollamaTest.success) {
        console.log("Direct Ollama connection successful after error!");
        
        // Update cache with partial success
        statusCache.timestamp = now;
        statusCache.backend = false; // We're not sure about backend
        statusCache.ollama = true;   // But Ollama is available
        statusCache.models = ollamaTest.models || [];
        statusCache.statusMessage = 'Ollama available but backend connection failed';
        
        if (!silent) toast.warning('Connected to Ollama but backend may be unavailable');
        
        return {
          ...statusCache,
          lastChecked: now,
        };
      }
    } catch (innerError) {
      console.error("Error in direct Ollama connection attempt:", innerError);
    }
    
    // Update cache with error state
    statusCache.timestamp = now;
    statusCache.backend = false;
    statusCache.ollama = false;
    statusCache.statusMessage = 'Error checking connections';
    
    if (!silent) toast.error('Failed to check connections');
    
    return {
      ...statusCache,
      lastChecked: now,
    };
  }
};

export const getCachedStatus = () => {
  return {
    ...statusCache,
    lastChecked: statusCache.timestamp,
  };
};

// Check if a connection is established and ready for use
export const isConnected = () => {
  return statusCache.backend && statusCache.ollama;
};

// Export default for compatibility
export default {
  checkConnections,
  getCachedStatus,
  isConnected
};
