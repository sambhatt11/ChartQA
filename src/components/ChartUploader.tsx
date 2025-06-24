import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Upload, Image as ImageIcon, Loader2, AlertTriangle, ServerCrash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { useChartData } from '@/context/ChartDataContext';
import { useConnection } from '@/context/ConnectionContext';
import { extractChartDataFromBackend } from '@/services/api/chartService';
import { Alert, AlertDescription } from "@/components/ui/alert";
import debugUtils from '@/utils/debugUtils';

declare global {
  interface Window {
    __chartImageUrl?: string;
  }
}

const SAMPLE_CHART_DATA = {
  title: "Monthly Sales Data",
  headers: ["Month", "Sales", "Profit", "Customers"],
  data: [
    ["Jan", "1200", "350", "45"],
    ["Feb", "1500", "420", "52"],
    ["Mar", "1800", "530", "61"],
    ["Apr", "1300", "390", "48"],
    ["May", "1900", "580", "65"],
  ],
  rawText: "| Month | Sales | Profit | Customers |\n|-------|-------|--------|----------|\n| Jan | 1200 | 350 | 45 |\n| Feb | 1500 | 420 | 52 |\n| Mar | 1800 | 530 | 61 |\n| Apr | 1300 | 390 | 48 |\n| May | 1900 | 580 | 65 |",
  formattedTable: "+---------+---------+---------+-----------+\n| Month   | Sales   | Profit  | Customers |\n+=========+=========+=========+===========+\n| Jan     | 1200    | 350     | 45        |\n+---------+---------+---------+-----------+\n| Feb     | 1500    | 420     | 52        |\n+---------+---------+---------+-----------+\n| Mar     | 1800    | 530     | 61        |\n+---------+---------+---------+-----------+\n| Apr     | 1300    | 390     | 48        |\n+---------+---------+---------+-----------+\n| May     | 1900    | 580     | 65        |\n+---------+---------+---------+-----------+"
};

interface ChartUploaderProps {
  demoMode?: boolean;
}

const ChartUploader: React.FC<ChartUploaderProps> = ({ demoMode = false }) => {
  const { setChartData, setUploadedImageUrl, setLoading, setProcessingError, resetChart } = useChartData();
  const connectionContext = useConnection();
  const { backend, ollama } = connectionContext;
  
  const [dragActive, setDragActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const simulateProgress = useCallback(() => {
    setProgress(0);
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 95) {
          clearInterval(interval);
          return 95;
        }
        const remaining = 95 - prev;
        const increment = Math.random() * Math.min(10, remaining / 5);
        return Math.min(95, prev + increment);
      });
    }, 800);
    return interval;
  }, []);
  
  const loadSampleData = useCallback(() => {
    setLoading(true);
    setIsProcessing(true);
    
    const progressInterval = simulateProgress();
    
    setTimeout(() => {
      clearInterval(progressInterval);
      
      setUploadedImageUrl("/placeholder-chart.png");
      
      setChartData(SAMPLE_CHART_DATA);
      
      setProgress(100);
      setIsProcessing(false);
      setLoading(false);
      
      toast.success("Sample chart data loaded successfully");
      
    }, 1500);
  }, [setChartData, setUploadedImageUrl, setLoading, simulateProgress]);
  
  useEffect(() => {
    if (demoMode) {
      console.log("Demo mode enabled, using sample data automatically");
      loadSampleData();
    }
  }, [demoMode, loadSampleData]);
  
  const processImageFile = useCallback(async (file: File) => {
    if (!file.type.match('image.*')) {
      toast.error("Please upload an image file");
      return;
    }
    
    try {
      resetChart();
      setUploadError(null);
      setIsProcessing(true);
      setLoading(true);
      setProcessingError(null);
      
      const imageUrl = URL.createObjectURL(file);
      setUploadedImageUrl(imageUrl);
      
      window.__chartImageUrl = imageUrl;
      
      const progressInterval = simulateProgress();
      
      const toastId = toast.loading("Analyzing chart image. This may take up to 60 seconds...");
      
      debugUtils.logDataProcessing("chart image", file.size);
      
      if (!backend || demoMode) {
        console.log(`[Chart] ${demoMode ? 'Demo mode enabled' : 'Backend not available'}, using sample data`);
        
        await new Promise(resolve => setTimeout(resolve, 1500));
        clearInterval(progressInterval);
        setProgress(100);
        setChartData(SAMPLE_CHART_DATA);
        
        toast.success(demoMode ? 'Using sample data (demo mode)' : 'Using sample data (backend not available)', { id: toastId });
        setIsProcessing(false);
        setLoading(false);
        debugUtils.logDataProcessingSuccess("sample chart data");
        return;
      }
      
      console.log("[Chart] Calling backend API to extract chart data");
      
      const response = await extractChartDataFromBackend(file);
      clearInterval(progressInterval);
      setProgress(100);
      
      if (!response.success) {
        throw new Error(response.error || "Failed to extract chart data");
      }
      
      const chartData = response.data;
      
      if (!chartData || !chartData.headers || !Array.isArray(chartData.data)) {
        console.error("[Chart] Invalid chart data structure:", chartData);
        throw new Error("Received invalid chart data structure from backend");
      }
      
      const invalidRows = chartData.data.findIndex((row: any) => !Array.isArray(row));
      if (invalidRows >= 0) {
        console.error(`[Chart] Invalid row at index ${invalidRows}:`, chartData.data[invalidRows]);
        toast.warning(`Data at row ${invalidRows} has an invalid structure. Attempting to fix...`, { id: toastId });
        
        chartData.data = chartData.data.map((row: any, i: number) => {
          if (!Array.isArray(row)) {
            console.warn(`Converting non-array row ${i}:`, row);
            if (typeof row === 'object') {
              return Object.values(row);
            }
            return [String(row)];
          }
          return row;
        });
      }
      
      console.log("[Chart] Setting chart data:", chartData);
      setChartData(chartData);
      toast.success('Chart analysis complete!', { id: toastId });
      debugUtils.logDataProcessingSuccess("chart data", `Title: ${chartData.title}`);
      
    } catch (error: any) {
      console.error('[Chart] Error processing chart:', error);
      
      let errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      if (error.name === 'AbortError') {
        errorMessage = "Chart processing was aborted. Please try again.";
      } else if (error.message?.includes('timeout') || error.name === 'TimeoutError') {
        errorMessage = "Analysis timed out. The chart may be too complex or the server is busy.";
      }
      
      setProcessingError(errorMessage);
      setUploadError(errorMessage);
      
      toast.error(`Chart analysis failed: ${errorMessage}`);
      debugUtils.logDataProcessingError("chart image", error instanceof Error ? error : new Error(String(error)));
      
      if (backend && !demoMode) {
        console.log("[Chart] Backend error. Offering to use sample data.");
        toast.info("Would you like to use sample data instead?", {
          duration: 10000,
          action: {
            label: "Use Sample Data",
            onClick: () => {
              setChartData(SAMPLE_CHART_DATA);
              toast.success("Using sample data instead");
              setUploadError(null);
              setProcessingError(null);
            }
          }
        });
      } else {
        console.log("[Chart] Using sample data due to no backend");
        setChartData(SAMPLE_CHART_DATA);
        toast.info('Using sample data instead');
      }
      
    } finally {
      setProgress(100);
      setIsProcessing(false);
      setLoading(false);
    }
  }, [backend, resetChart, setChartData, setLoading, setProcessingError, setUploadedImageUrl, simulateProgress, demoMode]);
  
  const handleDrag = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);
  
  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processImageFile(e.dataTransfer.files[0]);
    }
  }, [processImageFile]);
  
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processImageFile(e.target.files[0]);
    }
  }, [processImageFile]);
  
  const handleRetry = useCallback(() => {
    if (fileInputRef.current?.files && fileInputRef.current.files[0]) {
      processImageFile(fileInputRef.current.files[0]);
    } else {
      setUploadError(null);
      setProcessingError(null);
    }
  }, [processImageFile, setProcessingError]);
  
  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };
  
  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center p-4"
      onDragEnter={handleDrag}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Card 
          className={`w-full border-2 border-dashed transition-colors ${
            dragActive ? 'border-primary bg-primary/5 shadow-lg' : 'border-border'
          }`}
        >
          <CardContent
            className="flex flex-col items-center justify-center space-y-6 p-10"
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            {isProcessing ? (
              <div className="flex flex-col items-center py-8 w-full space-y-6">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                >
                  <Loader2 className="h-10 w-10 text-primary" />
                </motion.div>
                <p className="text-center font-medium text-lg">
                  Analyzing chart...
                </p>
                <div className="w-full space-y-2">
                  <Progress value={progress} className="w-full" />
                  <p className="text-xs text-center text-muted-foreground">
                    {demoMode ? "Loading sample data..." : "This can take up to a minute"}
                  </p>
                </div>
              </div>
            ) : uploadError ? (
              <div className="flex flex-col items-center py-6 w-full space-y-6">
                <ServerCrash className="h-10 w-10 text-destructive" />
                <div className="space-y-2 text-center">
                  <h3 className="font-semibold text-xl">Chart Analysis Failed</h3>
                  <Alert variant="destructive" className="mt-2">
                    <AlertDescription>{uploadError}</AlertDescription>
                  </Alert>
                  <div className="pt-4 flex gap-3 justify-center">
                    <Button 
                      variant="default"
                      onClick={handleRetry}
                    >
                      Try Again
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => {
                        resetChart();
                        setUploadError(null);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setChartData(SAMPLE_CHART_DATA);
                        toast.success("Using sample data instead");
                        setUploadError(null);
                        setProcessingError(null);
                      }}
                    >
                      Use Sample Data
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <motion.div 
                  className="rounded-full bg-primary/10 p-6"
                  whileHover={{ scale: 1.05 }}
                  transition={{ type: "spring", stiffness: 400, damping: 10 }}
                >
                  <ImageIcon className="h-10 w-10 text-primary" />
                </motion.div>
                
                <div className="space-y-3 text-center">
                  <h3 className="font-semibold text-xl">Upload a chart image</h3>
                  <p className="text-sm text-muted-foreground">
                    Drag and drop or click to upload a chart image for analysis
                  </p>
                </div>
                
                <div className="flex flex-col gap-3 justify-center w-full">
                  <Button 
                    onClick={handleButtonClick}
                    disabled={isProcessing}
                    className="text-md px-6"
                    size="lg"
                  >
                    <Upload className="mr-2 h-5 w-5" />
                    Choose Image
                  </Button>
                  
                  <Button 
                    variant="outline"
                    onClick={loadSampleData}
                    disabled={isProcessing}
                  >
                    Use Sample Data
                  </Button>
                  
                  <input 
                    ref={fileInputRef}
                    id="chart-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Supported formats: JPG, PNG, GIF
                </p>
                
                {demoMode && (
                  <div className="mt-2 p-3 bg-primary/10 text-primary-foreground rounded-md text-sm flex items-center space-x-2">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                    <span>Running in demo mode - no backend connection required.</span>
                  </div>
                )}
                
                {!backend && !demoMode && (
                  <div className="mt-2 p-3 bg-yellow-50 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200 rounded-md text-sm flex items-center space-x-2">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                    <span>Backend is unavailable. Will use sample data for demonstration.</span>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default ChartUploader;
