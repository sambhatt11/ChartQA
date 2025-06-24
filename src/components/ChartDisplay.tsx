
import React, { useMemo, useState } from 'react';
import { useChartData } from '@/context/ChartDataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { motion } from 'framer-motion';
import DataFlowStatus from './DataFlowStatus';

const COLORS = ['#3b82f6', '#10b981', '#ef4444', '#f97316', '#8b5cf6', '#ec4899'];

const ChartDisplay = () => {
  const { chartData, uploadedImageUrl } = useChartData();
  const [activeTab, setActiveTab] = useState('image');

  // Check if chart data exists
  if (!chartData || !uploadedImageUrl) return null;

  // Format data for charts
  const formattedData = useMemo(() => {
    if (!chartData.data) return [];
    return chartData.data.map(item => {
      const obj: Record<string, any> = {};
      chartData.headers.forEach((header, i) => {
        // Try to convert to numbers for numeric data
        const value = item[i];
        const numValue = parseFloat(value);
        obj[header] = isNaN(numValue) ? value : numValue;
      });
      return obj;
    });
  }, [chartData]);

  // Determine numeric fields for charts
  const numericFields = useMemo(() => {
    if (!chartData.headers || !chartData.data.length) return [];
    
    return chartData.headers.filter((header, index) => {
      // Check first row to determine if values appear numeric
      const firstRowValue = chartData.data[0][index];
      return !isNaN(parseFloat(firstRowValue)) && isFinite(firstRowValue);
    });
  }, [chartData]);

  // Get first non-numeric field for X-axis (usually categories, dates, etc)
  const categoryField = useMemo(() => {
    if (!chartData.headers) return '';
    const nonNumericField = chartData.headers.find((header, index) => {
      const firstRowValue = chartData.data[0][index];
      return isNaN(parseFloat(firstRowValue)) || !isFinite(firstRowValue);
    });
    return nonNumericField || chartData.headers[0];
  }, [chartData]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="h-full flex flex-col overflow-hidden"
    >
      <DataFlowStatus chartData={chartData} />
      
      <Tabs 
        value={activeTab} 
        onValueChange={setActiveTab} 
        className="flex-1 flex flex-col overflow-hidden"
      >
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="image">Image</TabsTrigger>
          <TabsTrigger value="table">Table</TabsTrigger>
          <TabsTrigger value="line">Line Chart</TabsTrigger>
          <TabsTrigger value="bar">Bar Chart</TabsTrigger>
        </TabsList>
        
        <div className="flex-1 overflow-hidden p-2">
          <TabsContent value="image" className="h-full flex items-center justify-center m-0">
            <Card className="w-full h-full flex items-center justify-center overflow-hidden">
              <AspectRatio ratio={16/9} className="max-h-full w-auto p-2">
                <img 
                  src={uploadedImageUrl} 
                  alt={chartData.title || "Chart"} 
                  className="max-h-full max-w-full object-contain rounded-md shadow-sm"
                />
              </AspectRatio>
            </Card>
          </TabsContent>
          
          <TabsContent value="table" className="h-full overflow-auto m-0">
            <Card className="h-full">
              <CardHeader className="pb-0">
                <CardTitle className="text-lg">{chartData.title || "Chart Data"}</CardTitle>
              </CardHeader>
              <CardContent className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {chartData.headers.map((header, i) => (
                        <TableHead key={i} className="font-semibold">
                          {header}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {chartData.data.map((row, i) => (
                      <TableRow key={i}>
                        {row.map((cell: string, j: number) => (
                          <TableCell key={j}>{cell}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="line" className="h-full m-0">
            <Card className="h-full p-4">
              <CardHeader className="p-0 pb-4">
                <CardTitle className="text-lg">{chartData.title || "Line Chart"}</CardTitle>
              </CardHeader>
              <CardContent className="p-0 h-[calc(100%-4rem)]">
                {numericFields.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={formattedData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey={categoryField} />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      {numericFields.map((field, index) => (
                        <Line
                          key={field}
                          type="monotone"
                          dataKey={field}
                          stroke={COLORS[index % COLORS.length]}
                          activeDot={{ r: 8 }}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    No numeric data available for charting
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="bar" className="h-full m-0">
            <Card className="h-full p-4">
              <CardHeader className="p-0 pb-4">
                <CardTitle className="text-lg">{chartData.title || "Bar Chart"}</CardTitle>
              </CardHeader>
              <CardContent className="p-0 h-[calc(100%-4rem)]">
                {numericFields.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={formattedData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey={categoryField} />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      {numericFields.map((field, index) => (
                        <Bar
                          key={field}
                          dataKey={field}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    No numeric data available for charting
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </div>
      </Tabs>
    </motion.div>
  );
};

export default ChartDisplay;
