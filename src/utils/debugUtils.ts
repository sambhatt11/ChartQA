
/**
 * Debug Utilities
 * Tools for tracking and logging application behavior
 */

// Debug level constants
export const DEBUG_LEVEL = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug'
};

// Statistics tracking
const connectionStats = {
  attempts: 0,
  successes: 0,
  failures: 0,
  lastError: null as Error | null,
  lastSuccess: null as Date | null
};

const ollamaStats = {
  requests: 0,
  successes: 0,
  failures: 0,
  averageResponseTime: 0,
  totalResponseTime: 0,
  lastError: null as Error | null,
  lastModel: ''
};

// Data processing stats
const dataProcessingStats = {
  attempts: 0,
  successes: 0,
  failures: 0,
  lastError: null as Error | null,
  lastProcessed: null as Date | null
};

// Current debug level
let currentDebugLevel = DEBUG_LEVEL.INFO;

// Set debug level
export function setDebugLevel(level: string) {
  currentDebugLevel = level;
  console.log(`[Debug] Debug level set to ${level}`);
}

// Analysis history
const analysisHistory: {question: string; answer: string}[] = [];

// Log connection attempt
export function logConnectionAttempt(url: string) {
  connectionStats.attempts++;
  console.log(`[Debug] Connection attempt to ${url}`);
}

// Log connection success
export function logConnectionSuccess(url: string) {
  connectionStats.successes++;
  connectionStats.lastSuccess = new Date();
  console.log(`[Debug] Connection successful to ${url}`);
}

// Log connection error
export function logConnectionError(url: string, error: Error) {
  connectionStats.failures++;
  connectionStats.lastError = error;
  console.error(`[Debug] Connection failed to ${url}:`, error);
}

// Log Ollama interaction
export function logOllamaInteraction(prompt: string, model: string) {
  ollamaStats.requests++;
  ollamaStats.lastModel = model;
  console.log(`[Debug] Ollama interaction with model ${model}`);
}

// Log Ollama response
export function logOllamaResponse(model: string, responseLength: number, responseTime: number) {
  ollamaStats.successes++;
  ollamaStats.totalResponseTime += responseTime;
  ollamaStats.averageResponseTime = ollamaStats.totalResponseTime / ollamaStats.successes;
  
  console.log(`[Debug] Ollama response from ${model}, length: ${responseLength}, time: ${responseTime}ms`);
}

// Log Ollama error
export function logOllamaError(model: string, error: Error) {
  ollamaStats.failures++;
  ollamaStats.lastError = error;
  console.error(`[Debug] Ollama error with model ${model}:`, error);
}

// Log data processing attempt
export function logDataProcessing(dataType: string, sizeOrCount: number) {
  dataProcessingStats.attempts++;
  console.log(`[Debug] Processing ${dataType} (size: ${sizeOrCount})`);
}

// Log data processing success
export function logDataProcessingSuccess(dataType: string, details?: string) {
  dataProcessingStats.successes++;
  dataProcessingStats.lastProcessed = new Date();
  console.log(`[Debug] Successfully processed ${dataType}${details ? `: ${details}` : ''}`);
}

// Log data processing error
export function logDataProcessingError(dataType: string, error: Error) {
  dataProcessingStats.failures++;
  dataProcessingStats.lastError = error;
  console.error(`[Debug] Error processing ${dataType}:`, error);
}

// Save analysis result
export function saveAnalysisResult(question: string, answer: string) {
  analysisHistory.push({ question, answer });
}

// Reset stats
export function resetDebugStats() {
  Object.assign(connectionStats, {
    attempts: 0,
    successes: 0,
    failures: 0,
    lastError: null,
    lastSuccess: null
  });
  
  Object.assign(ollamaStats, {
    requests: 0,
    successes: 0,
    failures: 0,
    averageResponseTime: 0,
    totalResponseTime: 0,
    lastError: null,
    lastModel: ''
  });
  
  Object.assign(dataProcessingStats, {
    attempts: 0,
    successes: 0,
    failures: 0,
    lastError: null,
    lastProcessed: null
  });
}

// Get debug data
export function getDebugData() {
  return {
    connections: connectionStats,
    ollama: ollamaStats,
    dataProcessing: dataProcessingStats,
    analysisHistory
  };
}

export default {
  logConnectionAttempt,
  logConnectionSuccess,
  logConnectionError,
  logOllamaInteraction,
  logOllamaResponse,
  logOllamaError,
  logDataProcessing,
  logDataProcessingSuccess,
  logDataProcessingError,
  saveAnalysisResult,
  resetDebugStats,
  getDebugData,
  setDebugLevel,
  DEBUG_LEVEL
};
