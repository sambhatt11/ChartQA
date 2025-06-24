
import React from 'react';
import { 
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChartData } from '@/context/ChartDataContext';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ChartPreviewProps {
  chartData: ChartData | null;
  imageUrl: string | null;
  isLoading?: boolean;
  error?: string | null;
}

const ChartPreview: React.FC<ChartPreviewProps> = ({
  chartData,
  imageUrl,
  isLoading = false,
  error = null
}) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-lg">Loading chart data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!chartData) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">No chart data available</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden p-4">
      <Tabs defaultValue="visual" className="flex-1 flex flex-col">
        <TabsList className="self-center mb-4">
          <TabsTrigger value="visual">Chart Image</TabsTrigger>
          <TabsTrigger value="data">Data Table</TabsTrigger>
          <TabsTrigger value="raw">Raw Text</TabsTrigger>
        </TabsList>
        
        <TabsContent 
          value="visual" 
          className="flex-1 overflow-auto data-[state=active]:flex data-[state=active]:flex-col"
        >
          <div className="flex items-center justify-center h-full">
            {imageUrl ? (
              <img 
                src={imageUrl} 
                alt={chartData.title || "Chart"} 
                className="max-w-full max-h-full object-contain rounded-md shadow-md"
              />
            ) : (
              <p className="text-muted-foreground">No image available</p>
            )}
          </div>
        </TabsContent>
        
        <TabsContent 
          value="data" 
          className="flex-1 overflow-hidden data-[state=active]:flex data-[state=active]:flex-col"
        >
          <Card className="flex-1 flex flex-col overflow-hidden">
            <CardHeader className="py-3">
              <CardTitle>{chartData.title || "Chart Data"}</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 p-0 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="p-4">
                  <div className="border rounded-md overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-muted">
                          {chartData.headers.map((header, i) => (
                            <th key={i} className="p-2 text-left font-medium text-muted-foreground border-b">
                              {header || `Column ${i+1}`}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {chartData.data.map((row, i) => (
                          <tr key={i} className={i % 2 === 0 ? 'bg-background' : 'bg-muted/30'}>
                            {row.map((cell, j) => (
                              <td key={j} className="p-2 border-t">
                                {cell || "-"}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent 
          value="raw" 
          className="flex-1 overflow-hidden data-[state=active]:flex data-[state=active]:flex-col"
        >
          <Card className="flex-1 flex flex-col overflow-hidden">
            <CardHeader className="py-3">
              <CardTitle>Raw Text Data</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 p-0 overflow-hidden">
              <ScrollArea className="h-full">
                <pre className="p-4 whitespace-pre-wrap font-mono text-sm">
                  {chartData.rawText || "No raw text available"}
                </pre>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ChartPreview;
