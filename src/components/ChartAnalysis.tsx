
import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useChartData } from '@/context/ChartDataContext';
import ChartUploader from './ChartUploader';
import ChartPreview from './ChartPreview';
import ChatInterface from './ChatInterface';
import OllamaChat from './OllamaChat';
import { useConnection } from '@/context/ConnectionContext';
import StatusBar from './StatusBar';

interface ChartAnalysisProps {
  demoMode?: boolean;
}

const ChartAnalysis: React.FC<ChartAnalysisProps> = ({ demoMode = false }) => {
  const { chartData, uploadedImageUrl, loading, processingError } = useChartData();
  const { backend, ollama } = useConnection();
  const [activeTab, setActiveTab] = useState<string>("view");
  
  // Detect if we have a valid chart
  const hasChartData = !!(chartData && 
    (chartData.rawText || 
     (Array.isArray(chartData.data) && chartData.data.length > 0)));
  
  // Update global reference to chart image URL for multimodal models
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      window.__chartImageUrl = uploadedImageUrl;
      console.log("Set global chart image URL:", uploadedImageUrl);
    }
    
    // Show a message if we detected chart data
    if (hasChartData) {
      console.log("Chart data detected:", {
        title: chartData?.title,
        headers: chartData?.headers?.length,
        dataRows: chartData?.data?.length,
        rawText: chartData?.rawText?.substring(0, 50) + '...'
      });
    }
  }, [uploadedImageUrl, hasChartData, chartData]);
  
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <StatusBar />
      
      <Tabs 
        defaultValue="view" 
        className="flex flex-col flex-grow overflow-hidden"
        value={activeTab}
        onValueChange={setActiveTab}
      >
        <div className="flex justify-center border-b">
          <TabsList>
            <TabsTrigger value="view">View Chart</TabsTrigger>
            <TabsTrigger value="chat" disabled={!hasChartData && !demoMode}>
              Chat
            </TabsTrigger>
            <TabsTrigger value="ask" disabled={!hasChartData && !demoMode}>
              Ask Ollama
            </TabsTrigger>
          </TabsList>
        </div>
        
        <TabsContent 
          value="view" 
          className="flex-grow overflow-hidden mt-0 data-[state=active]:flex data-[state=active]:flex-col"
        >
          {!hasChartData ? (
            <ChartUploader demoMode={demoMode} />
          ) : (
            <ChartPreview 
              chartData={chartData}
              imageUrl={uploadedImageUrl}
              isLoading={loading}
              error={processingError}
            />
          )}
        </TabsContent>
        
        <TabsContent 
          value="chat" 
          className="flex-grow overflow-hidden mt-0 data-[state=active]:flex data-[state=active]:flex-col"
        >
          <ChatInterface
            demoMode={demoMode || !backend || !ollama}
          />
        </TabsContent>
        
        <TabsContent 
          value="ask" 
          className="flex-grow overflow-hidden mt-0 data-[state=active]:flex data-[state=active]:flex-col"
        >
          <OllamaChat
            chartData={chartData}  
            demoMode={demoMode || !backend || !ollama}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ChartAnalysis;
