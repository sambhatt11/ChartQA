
import { toast } from 'sonner';

// Default timeout values
const DEFAULT_TIMEOUT = 30000; // 30 seconds
const EXTENDED_TIMEOUT = 420000; // 7 minutes for LLaVA models

// Sample responses for demo mode
const SAMPLE_RESPONSES = [
  "Based on the chart data, I can see a clear upward trend in the values from January to June, with the peak occurring in May.",
  "Looking at the data provided in your chart, there appears to be a correlation between the X and Y variables, with an R² value of approximately 0.78.",
  "The chart shows that Category A has the highest overall value at 42%, followed by Category B at 30% and Category C at 28%.",
  "From analyzing this chart, I can see that the quarterly results show a seasonal pattern with peaks in Q3 of each year.",
  "The data visualization indicates that there's a negative correlation between these two variables, with values decreasing as we move from left to right."
];

/**
 * Ask a question to Ollama LLM API
 */
export const askOllama = async (
  prompt: string,
  model: string = "llama3",
  imageBase64?: string | null,
  demoMode: boolean = false,
  extendedTimeout: boolean = false
): Promise<string> => {
  // Demo mode returns sample responses without calling Ollama
  if (demoMode) {
    console.log("Using demo mode for Ollama response");
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Return a random sample response
    return SAMPLE_RESPONSES[Math.floor(Math.random() * SAMPLE_RESPONSES.length)];
  }
  
  console.log(`Sending question to Ollama (model: ${model})`);
  console.log(`Prompt length: ${prompt.length} characters`);
  console.log(`Image included: ${!!imageBase64}`);
  
  try {
    // Determine if using a multimodal model
    const isMultimodal = model.toLowerCase().includes('llava') || 
                         model.toLowerCase().includes('bakllava') ||
                         model.toLowerCase().includes('cogvlm');
    
    // Set timeout based on model type and configuration
    const timeout = extendedTimeout || isMultimodal ? EXTENDED_TIMEOUT : DEFAULT_TIMEOUT;
    
    console.log(`Using timeout of ${timeout}ms for ${model} model`);
    
    // Prepare request payload
    let requestPayload: any = {
      model: model,
      prompt: prompt,
      stream: false
    };
    
    // Add image data for multimodal models
    if (isMultimodal && imageBase64) {
      console.log("Adding image data to request for multimodal model");
      requestPayload.images = [imageBase64];
    } else if (isMultimodal) {
      console.log("WARNING: Using multimodal model but no image provided");
    }
    
    // Create AbortController for timeout handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    // Make request to Ollama API
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestPayload),
      signal: controller.signal
    });
    
    // Clear the timeout since we got a response
    clearTimeout(timeoutId);
    
    // Handle HTTP errors
    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Ollama API HTTP error:", response.status, errorBody);
      throw new Error(`Ollama API returned ${response.status}: ${errorBody}`);
    }
    
    // Parse response
    const data = await response.json();
    
    if (!data || !data.response) {
      throw new Error("Invalid response format from Ollama API");
    }
    
    return data.response;
    
  } catch (error) {
    console.error("Error in askOllama:", error);
    
    // Handle specific error types
    if (error.name === 'AbortError') {
      const timeoutMsg = extendedTimeout ? 
        "Request to Ollama timed out after 7 minutes." : 
        "Request to Ollama timed out. The model might be busy or still loading.";
      
      throw new Error(timeoutMsg);
    }
    
    throw error;
  }
};

/**
 * Ask a question about chart data through the backend
 */
export const askQuestionToBackend = async (
  question: string,
  chartData: { title: string; rawText: string },
  options: { model?: string; imageBase64?: string | null } = {}
): Promise<{ answer: string }> => {
  try {
    // Default options
    const { model = "llama3", imageBase64 = null } = options;
    
    console.log(`Sending question to backend (model: ${model})`);
    console.log(`Question: ${question}`);
    console.log(`Chart title: ${chartData.title}`);
    console.log(`Raw text sample: ${chartData.rawText.substring(0, Math.min(100, chartData.rawText.length))}...`);
    console.log(`Image included: ${!!imageBase64}`);
    
    // Determine if using a multimodal model
    const isMultimodal = model.toLowerCase().includes('llava') || 
                         model.toLowerCase().includes('bakllava') || 
                         model.toLowerCase().includes('cogvlm');
    
    // Set timeout based on model type
    const timeout = isMultimodal ? EXTENDED_TIMEOUT : DEFAULT_TIMEOUT;
    
    // Create AbortController for timeout handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    // Prepare request body
    const requestBody: any = {
      question,
      title: chartData.title,
      table_data: chartData.rawText,
      model
    };
    
    if (isMultimodal && imageBase64) {
      requestBody.image_data = imageBase64;
    }
    
    // Make request to backend
    const response = await fetch('http://localhost:5000/question', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });
    
    // Clear the timeout since we got a response
    clearTimeout(timeoutId);
    
    // Handle HTTP errors
    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Backend API returned ${response.status}: ${errorBody}`);
    }
    
    // Parse response
    const data = await response.json();
    
    if (!data || !data.answer) {
      throw new Error("Invalid response format from backend API");
    }
    
    return { answer: data.answer };
    
  } catch (error) {
    console.error("Error in askQuestionToBackend:", error);
    
    // Handle specific error types
    if (error.name === 'AbortError') {
      throw new Error("Request to backend timed out. The server might be busy or unresponsive.");
    }
    
    throw error;
  }
};

/**
 * Ask a question about chart data, choosing direct or backend path
 * Based on the chart context and available data
 */
export const askQuestionAboutChart = async (
  question: string,
  chartData: any,
  model: string = "llama3"
): Promise<string> => {
  // Validate inputs
  if (!question.trim()) {
    throw new Error("Question cannot be empty");
  }
  
  if (!chartData) {
    throw new Error("No chart data provided for analysis");
  }
  
  try {
    console.log("Using askQuestionToBackend");
    const response = await askQuestionToBackend(question, {
      title: chartData.title || "Chart",
      rawText: chartData.rawText || JSON.stringify(chartData.data)
    }, { model });
    
    return response.answer;
  } catch (error) {
    console.error("Backend question failed, falling back to direct Ollama:", error);
    
    // Build a prompt for direct Ollama use
    const prompt = `
Chart: ${chartData.title || "Chart"}
Data: ${chartData.rawText || JSON.stringify(chartData.data)}

Question: ${question}

Please provide a detailed analysis based on the chart data.`;
    
    return askOllama(prompt, model);
  }
};
