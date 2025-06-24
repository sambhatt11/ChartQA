
import { toast } from 'sonner';
import { ChartData } from '@/services/chartAnalysisService';
import { extractChartDataFromBackend as extractChartDataAPI } from '@/services/backendService';

/**
 * Extract data from chart image
 */
export const extractChartDataFromBackend = async (imageFile: File): Promise<ChartData> => {
  try {
    if (!imageFile) {
      throw new Error("No image file provided");
    }
    
    // Validate image file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/svg+xml'];
    if (!validTypes.includes(imageFile.type)) {
      throw new Error(`Unsupported file type: ${imageFile.type}. Please use JPG, PNG, GIF, or SVG.`);
    }
    
    // Show toast for long-running operation
    const toastId = toast.loading("Processing chart with Pix2Struct model...", {
      duration: 60000, // 60 seconds
    });

    console.log(`Processing image ${imageFile.name} (${imageFile.size} bytes, type: ${imageFile.type})`);
    
    try {
      // Call the backend service to analyze the chart
      const response = await extractChartDataAPI(imageFile);
      
      console.log("Raw backend response:", response);
      
      // Validate the response from Pix2Struct
      if (!response || !response.success) {
        toast.dismiss(toastId);
        toast.error("Failed to connect to backend");
        throw new Error("Failed to connect to backend");
      }
      
      const responseData = response.data;
      console.log("Response data from backend:", responseData);
      
      // Handle raw text field with different potential naming (camelCase or snake_case)
      const rawText = responseData.rawText || 
                      ((responseData as any).raw_text ? (responseData as any).raw_text : "") || 
                      "";
      
      if (!rawText || rawText.length < 10) {
        toast.dismiss(toastId);
        toast.error("Pix2Struct failed to extract meaningful data from the chart");
        throw new Error("Invalid data extracted from chart");
      }
      
      // Process raw output for more reliable extraction
      let { title, headers, data } = responseData;
      
      console.log("Initial extraction:", { title, headers: headers?.length, data: data?.length });
      
      // Ensure we have valid title
      title = title || "Chart";
      
      // Process raw text to extract more reliable data
      const lines = rawText.split(/[\n<0x0A>]+/);
      console.log("Raw text lines:", lines.slice(0, 10));
      
      const parsedHeaders: string[] = [];
      const parsedData: any[] = [];
      
      let tableStarted = false;
      let foundTitle = false;
      
      // First pass to find title
      for (let i = 0; i < Math.min(5, lines.length); i++) {
        const line = lines[i].trim();
        if (line.includes('TITLE') || line.includes('Title:')) {
          const titleMatch = line.match(/TITLE\s*[:|]\s*(.*)/i) || 
                            line.match(/Title:\s*(.*)/i);
          
          if (titleMatch && titleMatch.length > 1) {
            title = titleMatch[1].trim();
            foundTitle = true;
            console.log("Found title in raw text:", title);
            break;
          } else if (line.includes('|')) {
            // Try split by pipe for title
            const parts = line.split('|')
              .map(part => part.trim())
              .filter(part => part.length > 0);
            
            if (parts.length > 1) {
              title = parts[parts.length - 1].trim();
              foundTitle = true;
              console.log("Found title using pipe split:", title);
              break;
            }
          }
        }
      }
      
      // Second pass for headers and data
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        // Skip title line if we've identified it
        if (foundTitle && (line.includes('TITLE') || line.includes('Title:'))) {
          continue;
        }
        
        if (line.includes('|')) {
          tableStarted = true;
          const parts = line.split('|')
            .map(part => part.trim())
            .filter(part => part.length > 0);
          
          if (parts.length > 0) {
            if (!parsedHeaders.length && tableStarted) {
              // First line with pipe delimiters after title is likely header
              parsedHeaders.push(...parts);
              console.log("Found headers in raw text:", parsedHeaders);
            } else {
              // Only add non-empty rows
              if (parts.some(part => part.trim().length > 0)) {
                parsedData.push(parts);
              }
            }
          }
        }
      }
      
      // If no data found with pipe delimiters, look for other patterns
      if (parsedData.length === 0) {
        console.log("No data found with pipe delimiters, trying other patterns");
        
        // Look for lines with numbers or data patterns
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          
          // Skip potential header or title lines
          if (line.includes('TITLE') || line.includes('Title:') || 
              i === 0 || (parsedHeaders.length === 0 && i === 1)) {
            continue;
          }
          
          // Check if line contains data (numbers, percentages, etc.)
          if (/\d/.test(line)) {
            // Try to split by common delimiters
            const parts = line.split(/[\s\t,]+/)
              .filter(part => part.trim().length > 0);
            
            if (parts.length > 1) {
              parsedData.push(parts);
            }
          }
        }
      }
      
      console.log("Parsed from raw text:", { 
        parsedHeaders: parsedHeaders.length, 
        parsedData: parsedData.length 
      });
      
      // Use the best data we have - either from direct response or parsed from raw text
      headers = Array.isArray(headers) && headers.length > 0 ? headers : [];
      data = Array.isArray(data) && data.length > 0 ? data : [];
      
      if (parsedHeaders.length > 0 && (headers.length === 0 || parsedHeaders.length >= headers.length)) {
        headers = parsedHeaders;
      }
      
      if (parsedData.length > 0 && (data.length === 0 || parsedData.length >= data.length)) {
        data = parsedData;
      }
      
      // Fallback for empty headers
      if (headers.length === 0) {
        // Create default column headers
        const maxCols = data.length > 0 ? Math.max(...data.map(row => Array.isArray(row) ? row.length : 1)) : 1;
        headers = Array.from({ length: maxCols }, (_, i) => `Column ${i + 1}`);
      }
      
      // Fallback for empty data
      if (data.length === 0) {
        console.warn("No valid data rows found, creating default empty row");
        data = [Array(headers.length).fill("")];
      }
      
      // Ensure all rows have same number of columns
      const maxCols = Math.max(
        headers.length,
        ...data.map(row => Array.isArray(row) ? row.length : 0)
      );
      
      headers = headers.concat(Array(Math.max(0, maxCols - headers.length)).fill(""));
      data = data.map(row => {
        if (!Array.isArray(row)) {
          return [String(row)].concat(Array(maxCols - 1).fill(""));
        }
        return row.concat(Array(Math.max(0, maxCols - row.length)).fill(""));
      });
      
      // Filter out empty headers and trim values
      headers = headers.map(header => String(header).trim());
      data = data.map(row => row.map(cell => String(cell).trim()));
      
      // Log the processed data
      console.log("Final processed chart data:", {
        title,
        headers,
        dataRows: data.length,
        rawTextLength: rawText.length,
        rawTextPreview: rawText.substring(0, 100) + "..."
      });
      
      // Dismiss the loading toast
      toast.dismiss(toastId);
      toast.success("Chart data successfully extracted!");
      
      // Generate formatted table if not provided
      const formattedTable = responseData.formattedTable || 
                             ((responseData as any).formatted_table ? (responseData as any).formatted_table : "") || 
                             generateFormattedTable(headers, data);
      
      return {
        title,
        headers,
        data,
        rawText,
        formattedTable
      };
    } catch (error) {
      toast.dismiss(toastId);
      throw error;
    }
  } catch (error) {
    console.error("Error extracting chart data with Pix2Struct:", error);
    toast.error(`Failed to extract chart data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    throw error;
  }
};

/**
 * Helper function to generate a formatted table similar to Python's tabulate
 */
export function generateFormattedTable(headers: string[], data: any[]): string {
  if (!headers || !data) return "";
  
  // Calculate column widths
  const colWidths = headers.map((header, colIndex) => {
    const headerLength = header.length;
    const maxDataLength = Math.max(0, ...data.map(row => 
      row[colIndex] ? String(row[colIndex]).length : 0
    ));
    return Math.max(headerLength, maxDataLength);
  });
  
  // Generate table separator line
  const separator = colWidths.map(width => '-'.repeat(width + 2)).join('+');
  const headerSeparator = colWidths.map(width => '='.repeat(width + 2)).join('+');
  
  // Format header row
  const formattedHeader = '| ' + headers.map((header, i) => 
    header.padEnd(colWidths[i])
  ).join(' | ') + ' |';
  
  // Format data rows
  const formattedData = data.map(row => 
    '| ' + row.map((cell, i) => 
      String(cell).padEnd(colWidths[i] || 0)
    ).join(' | ') + ' |'
  );
  
  // Combine all parts
  return [
    '+' + separator + '+',
    formattedHeader,
    '+' + headerSeparator + '+',
    ...formattedData,
    '+' + separator + '+'
  ].join('\n');
}
