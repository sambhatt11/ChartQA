
import { create } from 'zustand';

interface ChartState {
  chartData: any | null;
  uploadedImageUrl: string | null;
  extractionError: string | null;
  isListening: boolean;
  setChartData: (data: any) => void;
  setUploadedImageUrl: (url: string) => void;
  setExtractionError: (error: string) => void;
  setIsListening: (isListening: boolean) => void;
  clearAll: () => void;
}

const useChartStore = create<ChartState>((set) => ({
  chartData: null,
  uploadedImageUrl: null,
  extractionError: null,
  isListening: false,
  
  setChartData: (data) => set({ chartData: data }),
  setUploadedImageUrl: (url) => set({ uploadedImageUrl: url }),
  setExtractionError: (error) => set({ extractionError: error }),
  setIsListening: (isListening) => set({ isListening }),
  
  clearAll: () => set({
    chartData: null,
    uploadedImageUrl: null,
    extractionError: null,
    isListening: false
  })
}));

export default useChartStore;
