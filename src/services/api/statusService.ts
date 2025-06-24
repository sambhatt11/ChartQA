
/**
 * Status Service
 * Handles checking the status of backend and Ollama services
 */

import debugUtils from '@/utils/debugUtils';
import { tryFetchFromBackend } from './requestUtils';
import { DEFAULT_TIMEOUT } from './config';

// Status cache
let statusCache = {
  timestamp: 0,
  backend: false,
  ollama: false,
  models: [] as string[]
};

// Cache duration in ms (15 seconds)
const CACHE_DURATION = 15000;

/**
 * Reset the status cache
 */
export function resetStatusCache() {
  statusCache = {
    timestamp: 0,
    backend: false,
    ollama: false,
    models: []
  };
}

/**
 * Check backend status only
 */
export async function checkBackendStatus(): Promise<boolean> {
  try {
    const response = await tryFetchFromBackend('status', {}, 5000);
    return !!response && response.status === "Backend is running";
  } catch (error) {
    return false;
  }
}

/**
 * Test if Ollama is available and get available models
 */
export async function testOllamaConnection(): Promise<{success: boolean; message?: string; models?: string[]}> {
  try {
    const response = await tryFetchFromBackend('test-ollama', {}, 5000);
    
    if (!response.success) {
      return { success: false, message: response.message || "Ollama not available" };
    }
    
    return {
      success: true,
      models: response.models || []
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to connect to Ollama"
    };
  }
}

/**
 * Get available Ollama models
 */
export async function getAvailableModels(): Promise<string[]> {
  try {
    const response = await tryFetchFromBackend('models', {}, 5000);
    return response?.models || [];
  } catch (error) {
    console.error("Failed to get available models:", error);
    return [];
  }
}

/**
 * Check the full status of backend and Ollama
 * Uses cache if available and fresh
 */
export async function checkFullStatus(force: boolean = false): Promise<{
  backend: boolean;
  ollama: boolean;
  models: string[];
}> {
  const now = Date.now();
  
  // Return cached status if fresh and not forced to update
  if (!force && now - statusCache.timestamp < CACHE_DURATION) {
    return {
      backend: statusCache.backend,
      ollama: statusCache.ollama,
      models: statusCache.models,
    };
  }
  
  try {
    const response = await tryFetchFromBackend('status', {}, 5000);
    
    const backendAvailable = !!response && response.status === "Backend is running";
    const ollamaAvailable = !!response.ollama_available;
    const availableModels = response.available_models || [];
    
    // Update cache
    statusCache = {
      timestamp: now,
      backend: backendAvailable,
      ollama: ollamaAvailable,
      models: availableModels
    };
    
    return {
      backend: backendAvailable,
      ollama: ollamaAvailable,
      models: availableModels,
    };
  } catch (error) {
    // Log error but don't update cache
    console.error("Error checking status:", error);
    
    // Return current cache or default values if cache is empty
    return {
      backend: statusCache.backend,
      ollama: statusCache.ollama,
      models: statusCache.models,
    };
  }
}

/**
 * Get status - basic version that returns simple status object
 */
export async function getStatus() {
  return await checkFullStatus();
}

export default {
  checkBackendStatus,
  testOllamaConnection,
  getAvailableModels,
  checkFullStatus,
  getStatus,
  resetStatusCache
};
