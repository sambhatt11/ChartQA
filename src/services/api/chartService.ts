
/**
 * Chart Service
 * Handles extraction of data from chart images
 */

import debugUtils from '@/utils/debugUtils';
import { tryFetchFromBackend } from './requestUtils';
import { EXTRACT_TIMEOUT } from './config';

// Chart data interface
export interface ChartData {
  title: string;
  headers: string[];
  data: any[][];
  rawText: string;
  formattedTable?: string;
}

/**
 * Extract chart data from an image using the backend service
 */
export async function extractChartDataFromBackend(imageFile: File): Promise<{
  success: boolean;
  data?: ChartData;
  error?: string;
}> {
  if (!imageFile) {
    return { success: false, error: "No image file provided" };
  }

  try {
    debugUtils.logDataProcessing('chart image', imageFile.size);
    console.log(`[Chart] Extracting data from image: ${imageFile.name} (${imageFile.size} bytes)`);
    
    // Create form data
    const formData = new FormData();
    formData.append('image', imageFile);
    
    // Use longer timeout for extraction
    const response = await tryFetchFromBackend('extract', {
      method: 'POST',
      body: formData
    }, EXTRACT_TIMEOUT);
    
    console.log("[Chart] Backend extraction response received:", response);
    
    if (!response || !response.headers) {
      return { success: false, error: "Backend returned invalid data" };
    }
    
    // Convert backend response to expected format
    const chartData: ChartData = {
      title: response.title || 'Chart',
      headers: response.headers || [],
      data: response.data || [],
      rawText: response.raw_text || '',
      formattedTable: response.formatted_table || ''
    };
    
    // Validate the data structure
    if (!Array.isArray(chartData.headers) || !Array.isArray(chartData.data)) {
      throw new Error("Backend returned invalid data structure");
    }
    
    // Convert data to proper array structure if needed
    if (chartData.data.some(row => !Array.isArray(row))) {
      chartData.data = chartData.data.map(row => {
        if (Array.isArray(row)) return row;
        if (typeof row === 'object') return Object.values(row);
        return [String(row)];
      });
    }
    
    debugUtils.logDataProcessingSuccess('chart data', `Title: ${chartData.title}`);
    return { success: true, data: chartData };
  } catch (error) {
    debugUtils.logDataProcessingError('chart image', error instanceof Error ? error : new Error(String(error)));
    return { 
      success: false,
      error: error instanceof Error ? error.message : "Unknown error extracting data"
    };
  }
}
