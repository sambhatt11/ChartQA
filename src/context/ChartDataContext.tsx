
import React, { createContext, useState, useContext, useCallback } from "react";
import { toast } from "sonner";

export interface ChartData {
  title: string;
  headers: string[];
  data: any[][];
  rawText: string;
  formattedTable?: string;
}

interface ChartDataState {
  chartData: ChartData | null;
  uploadedImageUrl: string | null;
  loading: boolean;
  processingError: string | null;
  setChartData: (data: ChartData | any) => void;
  setUploadedImageUrl: (url: string | null) => void;
  setLoading: (loading: boolean) => void;
  setProcessingError: (error: string | null) => void;
  resetChart: () => void;
}

const ChartDataContext = createContext<ChartDataState | undefined>(undefined);

// Export the provider component directly
export const ChartDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [chartData, setChartDataState] = useState<ChartData | null>(null);
  const [uploadedImageUrl, setUploadedImageUrlState] = useState<string | null>(null);
  const [loading, setLoadingState] = useState<boolean>(false);
  const [processingError, setProcessingErrorState] = useState<string | null>(null);

  const handleSetChartData = useCallback((data: ChartData | any) => {
    console.log("Setting chart data in context:", data);
    
    if (!data) {
      console.error("Attempted to set null chart data");
      setProcessingErrorState("Received null chart data from server");
      return;
    }
    
    try {
      // Create normalized structure
      const normalizedData: ChartData = {
        title: data.title || "Chart",
        headers: [],
        data: [],
        rawText: data.rawText || data.raw_text || "",
        formattedTable: data.formattedTable || data.formatted_table || ""
      };
      
      // Process headers
      if (Array.isArray(data.headers)) {
        normalizedData.headers = data.headers;
      } else if (typeof data.headers === 'string') {
        normalizedData.headers = [data.headers];
      } else {
        console.warn("Missing or invalid headers in chart data, using fallback");
        normalizedData.headers = ["Column 1"];
      }
      
      // Process data rows
      if (Array.isArray(data.data)) {
        // If data is already an array, ensure each row is an array
        normalizedData.data = data.data.map((row: any, i: number) => {
          if (!row) {
            console.warn(`Row ${i} is null or undefined, replacing with empty array`);
            return [];
          }
          
          if (!Array.isArray(row)) {
            console.warn(`Row ${i} is not an array, converting:`, row);
            // If it's an object, try to convert it to an array
            if (typeof row === 'object') {
              return Object.values(row);
            }
            // If it's a primitive, wrap it in an array
            return [row];
          }
          return row;
        });
      } else if (data.data && typeof data.data === 'object') {
        // If data is an object, try to convert to rows
        const rows = Object.values(data.data);
        normalizedData.data = rows.map((row: any) => {
          if (Array.isArray(row)) return row;
          return [row]; 
        });
      } else {
        // Create empty data set with one row if nothing valid
        normalizedData.data = [Array(normalizedData.headers.length).fill("")];
      }
      
      // Ensure consistent row structure - all rows should have same number of columns
      const maxCols = Math.max(
        normalizedData.headers.length,
        ...normalizedData.data.map((row) => row.length)
      );
      
      normalizedData.headers = normalizedData.headers.concat(
        Array(Math.max(0, maxCols - normalizedData.headers.length)).fill("")
      );
      
      normalizedData.data = normalizedData.data.map(row => {
        if (row.length < maxCols) {
          return [...row, ...Array(maxCols - row.length).fill("")];
        }
        return row;
      });
      
      // If no rawText, create one from the data
      if (!normalizedData.rawText) {
        normalizedData.rawText = `${normalizedData.title}\n\n` + 
          normalizedData.headers.join("\t") + "\n" +
          normalizedData.data.map(row => row.join("\t")).join("\n");
      }
      
      console.log("Chart data processing complete:", normalizedData);
      setChartDataState(normalizedData);
      setProcessingErrorState(null);
    } catch (error) {
      console.error("Chart data validation failed:", error);
      setProcessingErrorState(error instanceof Error ? error.message : "Invalid chart data structure");
      
      // Clear chart data to prevent rendering errors
      setChartDataState(null);
      
      // Show error toast
      toast.error("Failed to process chart data: " + (error instanceof Error ? error.message : "Invalid data"));
    }
  }, []);

  const resetChart = useCallback(() => {
    console.log("Resetting chart data");
    
    if (uploadedImageUrl) {
      // Only revoke URLs that start with blob: to prevent errors
      if (uploadedImageUrl.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(uploadedImageUrl);
        } catch (error) {
          console.error("Error revoking URL:", error);
        }
      }
    }
    
    setChartDataState(null);
    setUploadedImageUrlState(null);
    setProcessingErrorState(null);
    setLoadingState(false);
    
    toast.info("Chart reset completed");
  }, [uploadedImageUrl]);

  const value = {
    chartData,
    uploadedImageUrl,
    loading,
    processingError,
    setChartData: handleSetChartData,
    setUploadedImageUrl: setUploadedImageUrlState,
    setLoading: setLoadingState,
    setProcessingError: setProcessingErrorState,
    resetChart
  };

  return (
    <ChartDataContext.Provider value={value}>
      {children}
    </ChartDataContext.Provider>
  );
};

// Export the hook separately using the named export
export function useChartData(): ChartDataState {
  const context = useContext(ChartDataContext);
  if (context === undefined) {
    throw new Error('useChartData must be used within a ChartDataProvider');
  }
  return context;
}
