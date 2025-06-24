
// Chart Analysis Service
import { toast } from 'sonner';

// Sample data for fallback when backend is not available - kept in main service for reference
const SAMPLE_ANSWERS = [
  "Based on the chart data, there's a clear upward trend in sales from January to May, with the highest point in May at 1,900 units.",
  "The profit margin appears to be consistently around 28-30% of sales throughout the period shown in the chart.",
  "Looking at the data, March shows the highest growth rate in both sales and profit compared to the previous month.",
  "If we analyze the chart, we can see that April experienced a dip in performance, dropping 27.8% in sales compared to March.",
  "The data visualization shows a positive correlation between sales volume and profit, with both metrics generally moving in the same direction."
];

export type ChartData = {
  title: string;
  headers: string[];
  data: any[];
  rawText: string;
  formattedTable?: string;
};

// Import utilities
import { extractChartDataFromBackend, generateFormattedTable } from '@/utils/chartDataExtractor';
import { askQuestionAboutChart } from '@/utils/chartQuestionHandler';
import { convertChartToCSV, downloadChartAsCSV } from '@/utils/chartCsvUtils';

// Re-export the utilities from this service for backward compatibility
export {
  extractChartDataFromBackend,
  askQuestionAboutChart,
  convertChartToCSV,
  downloadChartAsCSV,
  generateFormattedTable
};
