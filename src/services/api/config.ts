
/**
 * API Configuration
 */

// Timeouts (in milliseconds)
export const DEFAULT_TIMEOUT = 10000; // 10 seconds
export const EXTRACT_TIMEOUT = 60000;  // 60 seconds
export const OLLAMA_TIMEOUT = 420000;   // 7 minutes

// Backend URLs
export const BACKEND_URLS = [
  'http://localhost:5000',
  'http://127.0.0.1:5000'
];

// Default model
export const DEFAULT_MODEL = 'llama3';

// Max retries
export const MAX_RETRIES = 2;
export const RETRY_DELAY = 1000; // 1 second

// Export all configs as default object
export default {
  DEFAULT_TIMEOUT,
  EXTRACT_TIMEOUT,
  OLLAMA_TIMEOUT,
  BACKEND_URLS,
  DEFAULT_MODEL,
  MAX_RETRIES,
  RETRY_DELAY
};
