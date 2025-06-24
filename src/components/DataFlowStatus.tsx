import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronDown, ChevronUp, Database, BarChart3, ArrowRight, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useConnection } from '@/context/ConnectionContext';
import { getCachedStatus, checkConnections } from '@/services/connectionService';
import { ChartData } from '@/services/chartAnalysisService';

interface DataFlowStatusProps {
  chartData: ChartData | null;
}

const DataFlowStatus: React.FC<DataFlowStatusProps> = ({ chartData }) => {
  const [expanded, setExpanded] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(getCachedStatus());
  const { backend, ollama, selectedModel } = useConnection();
  
  const refreshStatus = async () => {
    setIsChecking(true);
    try {
      const status = await checkConnections(true, true); // Silent, force refresh
      setConnectionStatus(status);
    } finally {
      setIsChecking(false);
    }
  };
  
  useEffect(() => {
    refreshStatus();
  }, []);
  
  if (!chartData) return null;

  const rawText = chartData.rawText || "";
  
  const hasHeaders = Array.isArray(chartData.headers) && chartData.headers.length > 0;
  const hasData = Array.isArray(chartData.data) && chartData.data.length > 0;
  const hasValidRawText = rawText && rawText.length > 10;
  const hasFormattedTable = chartData.formattedTable && chartData.formattedTable.length > 0;
  
  const backendStatus = connectionStatus.backend ? "Connected" : "Disconnected";
  const ollamaStatus = connectionStatus.ollama ? 
    `Connected (${selectedModel || connectionStatus.models[0] || "unknown model"})` : 
    "Disconnected";
  
  const dataFlowStatus = (connectionStatus.backend && hasHeaders && hasData && hasValidRawText) 
    ? "Complete" 
    : "Incomplete";
  
  const validationDetails = {
    hasBackend: connectionStatus.backend,
    hasOllama: connectionStatus.ollama,
    hasHeaders,
    headerCount: hasHeaders ? chartData.headers.length : 0,
    hasData,
    dataRowCount: hasData ? chartData.data.length : 0,
    hasRawText: hasValidRawText,
    rawTextLength: rawText ? rawText.length : 0,
    hasFormattedTable,
  };
  console.log("Chart data validation:", validationDetails);
  
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-4"
    >
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              <div>
                <CardTitle className="text-sm">Data Flow Status</CardTitle>
                <CardDescription className="flex items-center gap-1">
                  <span>Pix2Struct</span>
                  <ArrowRight className="h-3 w-3" />
                  <span>Ollama</span>
                  <span className="text-xs">({selectedModel || connectionStatus.models[0] || "no model"})</span>
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="icon"
                className="h-6 w-6 p-0"
                onClick={refreshStatus}
                disabled={isChecking}
              >
                <RefreshCw className={`h-3 w-3 ${isChecking ? 'animate-spin' : ''}`} />
              </Button>
              <div className="flex gap-2">
                <Badge 
                  variant={connectionStatus.backend ? "default" : "destructive"} 
                  className="text-xs"
                >
                  Backend: {backendStatus}
                </Badge>
                <Badge 
                  variant={connectionStatus.ollama ? "default" : "destructive"} 
                  className="text-xs"
                >
                  Ollama: {ollamaStatus}
                </Badge>
                <Badge 
                  variant={dataFlowStatus === "Complete" ? "default" : "destructive"} 
                  className="text-xs"
                >
                  Data Flow: {dataFlowStatus}
                </Badge>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <Button
            variant="ghost" 
            size="sm"
            className="w-full justify-between h-7"
            onClick={() => setExpanded(!expanded)}
          >
            <span className="text-xs">View Details</span>
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </Button>
          
          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="pt-2 space-y-2 text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <div><strong>Chart Title:</strong> {chartData.title}</div>
                    <div><strong>Table Size:</strong> {chartData.headers?.length || 0} cols × {chartData.data?.length || 0} rows</div>
                  </div>
                  
                  <div className="border-t pt-1 mt-1">
                    <strong>Data Flow:</strong>
                    <div className="flex flex-col gap-1 mt-1">
                      <div className="flex items-center">
                        <Badge variant={connectionStatus.backend ? "outline" : "destructive"} className="text-xs mr-2">Step 1</Badge>
                        <span className={connectionStatus.backend ? "" : "text-destructive"}>
                          Backend Processing {connectionStatus.backend ? "✓" : "✗"}
                        </span>
                      </div>
                      
                      <div className="flex items-center">
                        <Badge variant={(hasHeaders && hasData) ? "outline" : "destructive"} className="text-xs mr-2">Step 2</Badge>
                        <span className={(hasHeaders && hasData) ? "" : "text-destructive"}>
                          Pix2Struct Data Extraction {(hasHeaders && hasData) ? "✓" : "✗"}
                          {hasHeaders && hasData && (
                            <span className="ml-1 text-muted-foreground">
                              ({chartData.headers?.length || 0} cols, {chartData.data?.length || 0} rows)
                            </span>
                          )}
                        </span>
                      </div>
                      
                      <div className="flex items-center">
                        <Badge variant={connectionStatus.ollama ? "outline" : "destructive"} className="text-xs mr-2">Step 3</Badge>
                        <span className={connectionStatus.ollama ? "" : "text-destructive"}>
                          Ollama Connection {connectionStatus.ollama ? "✓" : "✗"}
                        </span>
                        {connectionStatus.ollama && connectionStatus.models.length > 0 && (
                          <span className="ml-2 text-gray-500">
                            ({connectionStatus.models.join(', ')})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {rawText && (
                    <div>
                      <div className="flex items-center gap-1 mb-1">
                        <Database className="h-3 w-3" />
                        <strong>Raw Text Sample (for Ollama):</strong> {rawText.length} chars
                      </div>
                      <ScrollArea className="h-20 w-full mt-1 p-2 text-xs border rounded-md bg-muted/30">
                        <pre className="whitespace-pre-wrap font-mono">
                          {rawText.substring(0, 400)}
                          {rawText.length > 400 && '...'}
                        </pre>
                      </ScrollArea>
                    </div>
                  )}

                  {hasFormattedTable && (
                    <div>
                      <div className="flex items-center gap-1 mb-1">
                        <Database className="h-3 w-3" />
                        <strong>Formatted Table:</strong>
                      </div>
                      <ScrollArea className="h-60 w-full mt-1 p-2 text-xs border rounded-md bg-muted/30">
                        <pre className="whitespace-pre font-mono text-[10px]">
                          {chartData.formattedTable}
                        </pre>
                      </ScrollArea>
                    </div>
                  )}
                  
                  <div className="border-t pt-1 mt-1">
                    <strong>Connection Details:</strong>
                    <div className="mt-1 text-gray-500">
                      <div>Last checked: {new Date(connectionStatus.lastChecked).toLocaleTimeString()}</div>
                      {connectionStatus.statusMessage && (
                        <div>Status: {connectionStatus.statusMessage}</div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default DataFlowStatus;
