
import { toast } from 'sonner';
import { ChartData } from '@/services/chartAnalysisService';

/**
 * Convert chart data to CSV
 */
export const convertChartToCSV = (chartData: ChartData): string => {
  if (!chartData || !chartData.headers || !chartData.data) return "";
  
  // Create header row
  const csvContent = [
    chartData.headers.join(','),
    // Create data rows
    ...chartData.data.map(row => 
      chartData.headers.map(header => {
        const value = row[header];
        // Properly escape values with commas
        return typeof value === 'string' && value.includes(',') 
          ? `"${value}"`
          : value;
      }).join(',')
    )
  ].join('\n');
  
  return csvContent;
};

/**
 * Download chart data as CSV
 */
export const downloadChartAsCSV = (chartData: ChartData): void => {
  const csvContent = convertChartToCSV(chartData);
  if (!csvContent) {
    toast.error("No data available to download");
    return;
  }
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  
  // Set download attributes
  link.setAttribute("href", url);
  link.setAttribute("download", `${chartData.title || 'chart-data'}.csv`);
  link.style.visibility = 'hidden';
  
  // Append to document, trigger download, and clean up
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  
  toast.success("CSV file downloaded successfully");
};
