
/**
 * Request Utilities
 * Handles core HTTP request functionality with timeout and abort control
 */

import debugUtils from '@/utils/debugUtils';
import { DEFAULT_TIMEOUT } from './config';

// Active controllers for abortion tracking
const activeControllers: Map<string, AbortController> = new Map();

// Cleanup function for old controllers
export function cleanupOldControllers() {
  const now = Date.now();
  let cleaned = 0;
  
  activeControllers.forEach((controller, id) => {
    const [, timestamp] = id.split('-');
    if (now - parseInt(timestamp) > 120000) { // 2 minutes old
      controller.abort();
      activeControllers.delete(id);
      cleaned++;
    }
  });
  
  if (cleaned > 0) {
    console.log(`[Request] Cleaned up ${cleaned} stale request controllers`);
  }
}

// Use AbortController for better timeout handling
export const fetchWithTimeout = async (url: string, options: RequestInit, timeout: number = DEFAULT_TIMEOUT): Promise<Response> => {
  const requestId = `${url}-${Date.now()}`;
  const controller = new AbortController();
  activeControllers.set(requestId, controller);
  
  // Merge the provided signal with our controller
  const originalSignal = options.signal;
  
  // Create a timeout abort
  const timeoutId = setTimeout(() => {
    if (!controller.signal.aborted) {
      controller.abort(new DOMException('Request timed out', 'TimeoutError'));
      console.warn(`[Request] Request to ${url} timed out after ${timeout}ms`);
    }
  }, timeout);
  
  try {
    // Log connection attempt
    debugUtils.logConnectionAttempt(url);
    
    // Listen for abort on original signal
    if (originalSignal) {
      if (originalSignal.aborted) {
        controller.abort(originalSignal.reason);
      }
      originalSignal.addEventListener('abort', () => {
        controller.abort(originalSignal.reason);
      });
    }
    
    // Make the request with our controller's signal
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      mode: 'cors',
      cache: 'no-cache',
    });
    
    clearTimeout(timeoutId);
    
    // Log connection success
    if (response.ok) {
      debugUtils.logConnectionSuccess(url);
    } else {
      const errorText = await response.text();
      const error = new Error(`Backend responded with ${response.status}: ${errorText}`);
      debugUtils.logConnectionError(url, error);
      throw error;
    }
    
    return response;
  } catch (error: any) {
    clearTimeout(timeoutId);
    
    // Ensure we throw a proper error object
    const typedError = error instanceof Error ? error : new Error(String(error));
    
    // Special handling for abort errors
    if (typedError.name === 'AbortError') {
      // Check if this was because of our timeout
      if ((error as any)?.message === 'Request timed out') {
        const timeoutError = new Error(`Request to ${url} timed out after ${timeout}ms`);
        timeoutError.name = 'TimeoutError';
        debugUtils.logConnectionError(url, timeoutError);
        throw timeoutError;
      }
    }
    
    // Log connection error
    debugUtils.logConnectionError(url, typedError);
    
    throw typedError;
  } finally {
    // Always clean up
    activeControllers.delete(requestId);
  }
};

// Try each URL in order until one works
export async function tryFetchFromBackend(endpoint: string, options?: RequestInit, timeout: number = DEFAULT_TIMEOUT) {
  let lastError;
  
  const urls = ['http://localhost:5000', 'http://127.0.0.1:5000'];
  
  // Add debug information
  console.log(`[API] Trying to fetch from backend: ${endpoint}`);
  console.log(`[API] Will try URLs: ${urls.join(', ')}`);
  
  for (const baseUrl of urls) {
    try {
      const url = `${baseUrl}/${endpoint}`;
      console.log(`[API] Attempting request to: ${url}`);
      
      // Attempt to fetch with timeout
      const response = await fetchWithTimeout(url, options || {}, timeout);
      console.log(`[API] Success with ${url}`);
      
      // Parse the JSON response, but handle errors
      try {
        const data = await response.json();
        return data;
      } catch (parseError) {
        console.error(`[API] Error parsing JSON from ${url}:`, parseError);
        throw new Error(`Invalid JSON response from backend: ${parseError}`);
      }
    } catch (error) {
      lastError = error;
      console.log(`[API] Failed with ${baseUrl}/${endpoint}: ${error instanceof Error ? error.message : String(error)}`);
      // Try the next URL
    }
  }
  
  console.error(`[API] All backend endpoints failed for ${endpoint}`);
  throw lastError || new Error(`Failed to connect to backend at all endpoints`);
}

// Clean up all connections
export function cleanupConnections() {
  // Abort all active controllers
  activeControllers.forEach((controller, id) => {
    if (!controller.signal.aborted) {
      controller.abort();
      console.log(`[API] Aborted request: ${id}`);
    }
  });
  activeControllers.clear();
}

// Run cleanup every minute
setInterval(cleanupOldControllers, 60000);
