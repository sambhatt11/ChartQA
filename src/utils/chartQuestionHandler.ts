
import { toast } from 'sonner';
import { testOllamaConnection, askQuestionToBackend } from '@/services/backendService';
import { ChartData } from '@/services/chartAnalysisService';

// Sample data for fallback when backend is not available
const SAMPLE_ANSWERS = [
  "Based on the chart data, there's a clear upward trend in sales from January to May, with the highest point in May at 1,900 units.",
  "The profit margin appears to be consistently around 28-30% of sales throughout the period shown in the chart.",
  "Looking at the data, March shows the highest growth rate in both sales and profit compared to the previous month.",
  "If we analyze the chart, we can see that April experienced a dip in performance, dropping 27.8% in sales compared to March.",
  "The data visualization shows a positive correlation between sales volume and profit, with both metrics generally moving in the same direction."
];

/**
 * Convert image to base64 for multimodal models
 */
async function convertImageToBase64(imageUrl: string): Promise<string | null> {
  try {
    // Fetch the image if it's a URL or blob URL
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        // Strip the data URI prefix (e.g., "data:image/png;base64,")
        const base64Data = base64.split(',')[1];
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error("Error converting image to base64:", error);
    return null;
  }
}

/**
 * Create an enhanced prompt that encourages color description
 */
function createEnhancedPrompt(question: string, chartData: ChartData): string {
  // Base context from chart data
  const baseContext = `Title: ${chartData.title || 'Chart'}\nData: ${chartData.rawText}`;
  
  // Check if question is asking about colors specifically
  const isColorQuestion = question.toLowerCase().includes('color') || 
                         question.toLowerCase().includes('colours') ||
                         question.toLowerCase().includes('visual');
  
  // Standard question prompt
  let prompt = `
${baseContext}

Question: ${question}

Please provide a detailed answer based on the chart data provided.`;

  // Add color-specific instructions if colors are mentioned or it's a visual question
  if (isColorQuestion) {
    prompt += `\n\nIMPORTANT: Pay special attention to the colors used in the chart. Describe the color scheme, what colors represent different data points or series, and how colors are used to convey meaning.`;
  } else {
    // For all questions, encourage including visual aspects
    prompt += `\n\nIn your answer, please include observations about visual elements like colors, patterns, and design when relevant to the question.`;
  }
  
  return prompt;
}

/**
 * Ask a question about chart data
 */
export const askQuestionAboutChart = async (
  question: string,
  chartData: ChartData,
  model: string = "llama3"
): Promise<string> => {
  try {
    // Validate inputs
    if (!question.trim()) {
      throw new Error("Question cannot be empty");
    }
    
    if (!chartData || !chartData.rawText) {
      throw new Error("No valid chart data available for analysis");
    }
    
    // Test Ollama connectivity before sending the question
    console.log("Testing Ollama connection before sending question...");
    const ollamaTest = await testOllamaConnection();
    
    if (!ollamaTest.success) {
      console.error("Ollama connection test failed:", ollamaTest.message);
      toast.error(`Ollama not available: ${ollamaTest.message}`);
      return SAMPLE_ANSWERS[Math.floor(Math.random() * SAMPLE_ANSWERS.length)];
    }
    
    // Check if model is multimodal (llava) and if we have an image URL
    const isMultimodal = model.toLowerCase().includes('llava');
    let imageBase64: string | null = null;
    
    // Get image from context if available
    if (isMultimodal && window.__chartImageUrl) {
      console.log("Attempting to include chart image in multimodal query");
      try {
        imageBase64 = await convertImageToBase64(window.__chartImageUrl);
        if (imageBase64) {
          toast.info("Including chart image in the analysis");
        }
      } catch (error) {
        console.error("Error preparing image for multimodal analysis:", error);
        toast.warning("Could not include image in analysis, using text data only");
      }
    } else if (isMultimodal) {
      toast.warning("Multimodal model selected but no image available");
    }
    
    // Show toast for long-running operation
    const toastId = toast.loading(`Sending to Ollama (model: ${model})...`, {
      duration: 30000, // 30 seconds
    });
    
    // Create an enhanced prompt that encourages color description
    const enhancedPrompt = createEnhancedPrompt(question, chartData);
    
    // Log data being sent to Ollama for verification
    console.log("Data being sent to Ollama:");
    console.log("- Question:", question);
    console.log("- Chart title:", chartData.title);
    console.log("- Raw text sample:", chartData.rawText.substring(0, Math.min(200, chartData.rawText.length)));
    console.log("- Using model:", model);
    console.log("- Image included:", !!imageBase64);
    console.log("- Enhanced prompt:", enhancedPrompt);
    
    // Ask the question using the backend service
    try {
      // Pass model and image as options, with the enhanced prompt
      const response = await askQuestionToBackend(enhancedPrompt, {
        title: chartData.title,
        rawText: chartData.rawText
      }, { 
        model,
        imageBase64
      });
      
      // The response is now { answer: string } directly, not wrapped in data
      if (!response || !response.answer) {
        throw new Error("Ollama returned an empty response");
      }
      
      const answer = response.answer;
      
      // Dismiss the loading toast
      toast.dismiss(toastId);
      toast.success("Received answer from Ollama");
      
      return answer;
    } catch (error) {
      console.error("Error asking question to Ollama:", error);
      toast.dismiss(toastId);
      toast.error(`Ollama error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      // Fallback to sample answer
      return SAMPLE_ANSWERS[Math.floor(Math.random() * SAMPLE_ANSWERS.length)];
    }
  } catch (error) {
    console.error("Error asking question about chart:", error);
    toast.error(`Failed to analyze chart: ${error instanceof Error ? error.message : 'Unknown error'}`);
    throw error;
  }
};
