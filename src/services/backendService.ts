
/**
 * Backend Service (Main Export)
 * Handles connectivity to Flask backend and Ollama LLM service
 */

import { cleanupConnections } from './api/requestUtils';
import { getStatus, testOllamaConnection, getAvailableModels, checkBackendStatus, checkFullStatus, resetStatusCache } from './api/statusService';
import { extractChartDataFromBackend } from './api/chartService';
import { askOllama, askQuestionToBackend, askQuestionAboutChart } from './api/ollamaService';
import debugUtils from '@/utils/debugUtils';

// Create a safer version of askOllama that falls back to demo mode
export function askOllamaWithFallback(
  prompt: string,
  model: string = "llama3",
  imageBase64?: string
): Promise<string> {
  return askOllama(prompt, model, imageBase64, false)
    .catch((error) => {
      console.error("Error with Ollama, falling back to demo mode:", error);
      return askOllama(prompt, model, imageBase64, true);
    });
}

// Re-export functions from individual modules
export {
  getStatus,
  testOllamaConnection,
  getAvailableModels,
  extractChartDataFromBackend,
  askQuestionToBackend,
  checkBackendStatus,
  checkFullStatus,
  askOllama,
  askQuestionAboutChart
};

// Clean up all connections and reset cache
export function cleanupAllConnections() {
  resetStatusCache();
  cleanupConnections();
  debugUtils.resetDebugStats?.();
}

// Default export for compatibility
export default {
  getStatus,
  testOllamaConnection,
  getAvailableModels,
  extractChartDataFromBackend,
  askQuestionToBackend,
  checkBackendStatus,
  checkFullStatus,
  cleanupConnections: cleanupAllConnections,
  askOllama,
  askQuestionAboutChart,
  askOllamaWithFallback
};
