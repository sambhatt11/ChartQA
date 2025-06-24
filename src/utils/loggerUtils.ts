
/**
 * Logger utils for standardized logging
 * Connects with the debugUtils for consistent application logging
 */

import debugUtils from './debugUtils';
import { DEBUG_LEVEL } from './debugUtils';

// Configure log levels
const LOG_LEVEL = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug'
};

// Initialize logger with default configuration
const initLogger = () => {
  // Set debug level based on environment
  if (process.env.NODE_ENV === 'production') {
    debugUtils.setDebugLevel(DEBUG_LEVEL.ERROR);
  } else {
    debugUtils.setDebugLevel(DEBUG_LEVEL.INFO);
  }
  
  // Add timestamp to console logs
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;
  const originalConsoleInfo = console.info;
  const originalConsoleDebug = console.debug;
  
  // Format timestamp
  const timestamp = () => {
    const now = new Date();
    return now.toISOString();
  };
  
  // Override console methods to add timestamp
  console.log = function(...args) {
    originalConsoleLog.apply(console, [
      `${timestamp()} info:`, ...args
    ]);
  };
  
  console.error = function(...args) {
    originalConsoleError.apply(console, [
      `${timestamp()} error:`, ...args
    ]);
  };
  
  console.warn = function(...args) {
    originalConsoleWarn.apply(console, [
      `${timestamp()} warn:`, ...args
    ]);
  };
  
  console.info = function(...args) {
    originalConsoleInfo.apply(console, [
      `${timestamp()} info:`, ...args
    ]);
  };
  
  console.debug = function(...args) {
    originalConsoleDebug.apply(console, [
      `${timestamp()} debug:`, ...args
    ]);
  };
};

// Structured logging function
const log = (level: string, message: string, data?: any) => {
  const logEntry = data ? `${message} ${JSON.stringify(data)}` : message;
  
  switch (level) {
    case LOG_LEVEL.ERROR:
      console.error(logEntry);
      break;
    case LOG_LEVEL.WARN:
      console.warn(logEntry);
      break;
    case LOG_LEVEL.DEBUG:
      console.debug(logEntry);
      break;
    case LOG_LEVEL.INFO:
    default:
      console.info(logEntry);
  }
};

// Log API requests similar to Python code
const logAPIRequest = (url: string, attempt: number = 1) => {
  log(LOG_LEVEL.INFO, `API Request: ${url} (Attempt ${attempt})`);
  return debugUtils.logConnectionAttempt(url);
};

// Log chart processing
const logChartProcessing = (action: string, details?: any) => {
  log(LOG_LEVEL.INFO, `Rendering ${action} view`, details);
};

// Export all logging functions
export {
  initLogger,
  log,
  LOG_LEVEL,
  logAPIRequest,
  logChartProcessing
};

export default {
  initLogger,
  log,
  LOG_LEVEL,
  logAPIRequest,
  logChartProcessing
};
