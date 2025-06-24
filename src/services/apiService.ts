
/**
 * Core API Service for chart analysis application
 * Handles all communication with the backend server
 */

import { toast } from 'sonner';

// Connection configuration
const API_CONFIG = {
  URLS: ['http://localhost:5000', 'http://127.0.0.1:5000'],
  TIMEOUT_DEFAULT: 10000,
  TIMEOUT_EXTRACT: 60000,
  TIMEOUT_QUESTION: 45000,
  RETRY_DELAY: 1000,
  MAX_RETRIES: 2
};

// Interfaces
export interface ChartData {
  title: string;
  headers: string[];
  data: any[][];
  rawText: string;
  formattedTable?: string;
}

export interface ConnectionStatus {
  backend: boolean;
  ollama: boolean;
  models: string[];
  timestamp: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Core fetch function with timeout and multiple URL attempts
const fetchWithRetry = async <T>(
  endpoint: string, 
  options: RequestInit = {}, 
  timeout: number = API_CONFIG.TIMEOUT_DEFAULT
): Promise<ApiResponse<T>> => {
  let lastError: Error | null = null;
  
  // Try each URL with retries
  for (const baseUrl of API_CONFIG.URLS) {
    const url = `${baseUrl}/${endpoint}`;
    
    for (let attempt = 0; attempt <= API_CONFIG.MAX_RETRIES; attempt++) {
      try {
        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        console.log(`API Request: ${url} (Attempt ${attempt + 1})`);
        
        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
          mode: 'cors',
          cache: 'no-cache'
        });
        
        // Clear timeout since we got a response
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Server error ${response.status}: ${errorText}`);
        }
        
        // Parse the response
        const data = await response.json();
        return { success: true, data: data as T };
        
      } catch (error) {
        lastError = error as Error;
        
        // If it's an abort error (timeout) or last retry, continue to next URL
        if (error instanceof DOMException && error.name === 'AbortError') {
          console.error(`Request to ${url} timed out`);
          break;
        }
        
        // If we have retries left, wait before trying again
        if (attempt < API_CONFIG.MAX_RETRIES) {
          await new Promise(r => setTimeout(r, API_CONFIG.RETRY_DELAY));
        }
      }
    }
  }
  
  // All URLs and retries failed
  return { 
    success: false, 
    error: lastError?.message || 'Failed to connect to backend'
  };
};

// Connection status cache
let connectionCache: ConnectionStatus | null = null;

/**
 * Check backend server and Ollama availability
 */
export const checkConnection = async (force: boolean = false): Promise<ConnectionStatus> => {
  // Return cached data if available and not forced
  const now = Date.now();
  if (
    connectionCache && 
    !force && 
    now - connectionCache.timestamp < 30000
  ) {
    return connectionCache;
  }
  
  try {
    // First check if backend is running
    const statusResponse = await fetchWithRetry<{
      status: string;
      ollama_available?: boolean;
      available_models?: string[];
    }>('status', {}, 5000);
    
    if (!statusResponse.success) {
      // Backend not running
      const status = {
        backend: false,
        ollama: false,
        models: [],
        timestamp: now
      };
      connectionCache = status;
      return status;
    }
    
    // Check if we got Ollama status directly from the status endpoint
    if (statusResponse.data?.ollama_available !== undefined) {
      const status = {
        backend: true,
        ollama: !!statusResponse.data.ollama_available,
        models: statusResponse.data.available_models || [],
        timestamp: now
      };
      connectionCache = status;
      return status;
    }
    
    // If not, check Ollama separately
    const ollamaResponse = await fetchWithRetry<{
      success: boolean;
      models?: string[];
    }>('test-ollama', {}, 5000);
    
    const status = {
      backend: true,
      ollama: ollamaResponse.success && !!ollamaResponse.data?.success,
      models: ollamaResponse.data?.models || [],
      timestamp: now
    };
    
    connectionCache = status;
    return status;
  } catch (error) {
    const status = {
      backend: false,
      ollama: false,
      models: [],
      timestamp: now
    };
    connectionCache = status;
    return status;
  }
};

/**
 * Extract chart data from an uploaded image file
 */
export const extractChartData = async (imageFile: File): Promise<ApiResponse<ChartData>> => {
  if (!imageFile) {
    return { success: false, error: "No image file provided" };
  }

  try {
    // Create form data with image
    const formData = new FormData();
    formData.append('image', imageFile);
    
    // Send to backend
    const response = await fetchWithRetry<any>('extract', {
      method: 'POST',
      body: formData
    }, API_CONFIG.TIMEOUT_EXTRACT);
    
    if (!response.success || !response.data) {
      return { success: false, error: response.error || "Failed to extract chart data" };
    }
    
    // Convert response to our format
    const chartData: ChartData = {
      title: response.data.title || 'Chart',
      headers: response.data.headers || [],
      data: response.data.data || [],
      rawText: response.data.raw_text || '',
      formattedTable: response.data.formatted_table || ''
    };
    
    return { success: true, data: chartData };
  } catch (error) {
    return { 
      success: false,
      error: error instanceof Error ? error.message : "Unknown error extracting data"
    };
  }
};

/**
 * Ask a question about the chart data
 */
export const askQuestion = async (
  question: string,
  chartData: ChartData,
  model: string = 'llama3'
): Promise<ApiResponse<string>> => {
  if (!question.trim()) {
    return { success: false, error: "Question cannot be empty" };
  }
  
  try {
    const response = await fetchWithRetry<{ answer: string }>(
      'question',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          question,
          title: chartData.title,
          table_data: chartData.rawText,
          model
        })
      },
      API_CONFIG.TIMEOUT_QUESTION
    );
    
    if (!response.success || !response.data) {
      return { success: false, error: response.error || "Failed to get answer" };
    }
    
    return { success: true, data: response.data.answer };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error asking question"
    };
  }
};

/**
 * Get available models from Ollama
 */
export const getAvailableModels = async (): Promise<string[]> => {
  try {
    const response = await fetchWithRetry<{ models: string[] }>('models');
    if (response.success && response.data?.models) {
      return response.data.models;
    }
    return [];
  } catch (error) {
    console.error("Error getting models:", error);
    return [];
  }
};

export default {
  checkConnection,
  extractChartData,
  askQuestion,
  getAvailableModels
};
