
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { checkConnections } from '@/services/connectionService';
import { testOllamaConnection } from '@/services/backendService';
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";

interface DebugPanelProps {
  visible?: boolean;
}

const DebugPanel: React.FC<DebugPanelProps> = ({ visible = false }) => {
  const [expanded, setExpanded] = useState(visible);
  const [activeTab, setActiveTab] = useState("connections");
  const [connections, setConnections] = useState<any>({});
  const [ollamaTest, setOllamaTest] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  
  // Capture console logs
  useEffect(() => {
    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;
    const originalConsoleWarn = console.warn;
    
    const captureLog = (type: string, ...args: any[]) => {
      const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
      const formattedArgs = args.map(arg => {
        if (typeof arg === 'object' && arg !== null) {
          try {
            return JSON.stringify(arg, null, 2);
          } catch (e) {
            return String(arg);
          }
        }
        return String(arg);
      }).join(' ');
      
      setLogs(prev => [...prev, `[${timestamp}] [${type}] ${formattedArgs}`].slice(-100));
      return args;
    };
    
    console.log = (...args: any[]) => {
      originalConsoleLog(...captureLog('info', ...args));
    };
    
    console.error = (...args: any[]) => {
      originalConsoleError(...captureLog('error', ...args));
    };
    
    console.warn = (...args: any[]) => {
      originalConsoleWarn(...captureLog('warn', ...args));
    };
    
    return () => {
      console.log = originalConsoleLog;
      console.error = originalConsoleError;
      console.warn = originalConsoleWarn;
    };
  }, []);
  
  const checkStatus = async () => {
    setLoading(true);
    try {
      // Check connections
      const connectionStatus = await checkConnections(false, true);
      setConnections(connectionStatus);
      
      // Test Ollama
      const ollamaStatus = await testOllamaConnection();
      setOllamaTest(ollamaStatus);
    } catch (error) {
      console.error("Error checking status:", error);
    } finally {
      setLoading(false);
    }
  };
  
  // Run status check when visible
  useEffect(() => {
    if (expanded) {
      checkStatus();
    }
  }, [expanded]);
  
  return (
    <motion.div
      initial={{ height: 0 }}
      animate={{ height: expanded ? 'auto' : '40px' }}
      className="fixed bottom-0 right-0 w-full md:w-96 bg-background border-t border-l z-50"
    >
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex justify-between items-center h-10 rounded-none"
      >
        <span className="flex items-center gap-2">
          <AlertTriangle size={16} className="text-amber-500" />
          Debug Panel
        </span>
        {expanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
      </Button>
      
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="p-2"
          >
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full">
                <TabsTrigger value="connections" className="flex-1">Connections</TabsTrigger>
                <TabsTrigger value="logs" className="flex-1">Logs</TabsTrigger>
              </TabsList>
              
              <TabsContent value="connections" className="mt-2">
                <Card>
                  <CardHeader className="py-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">Connection Status</CardTitle>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={checkStatus} 
                        disabled={loading}
                        className="h-8 text-xs"
                      >
                        Refresh
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex items-center gap-2">
                        <div 
                          className={`w-2 h-2 rounded-full ${
                            connections.backend ? 'bg-green-500' : 'bg-red-500'
                          }`}
                        />
                        <span>Backend</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div 
                          className={`w-2 h-2 rounded-full ${
                            connections.ollama ? 'bg-green-500' : 'bg-red-500'
                          }`}
                        />
                        <span>Ollama</span>
                      </div>
                    </div>
                    
                    <div className="text-xs">
                      <div><strong>Models:</strong> {connections.models?.join(', ') || 'None found'}</div>
                      <div><strong>Ollama Test:</strong> {ollamaTest.success ? 'Success' : 'Failed'}</div>
                      <div><strong>Message:</strong> {ollamaTest.message || 'No message'}</div>
                      <div><strong>Last checked:</strong> {
                        connections.lastChecked ? 
                        new Date(connections.lastChecked).toLocaleTimeString() : 
                        'Never'
                      }</div>
                    </div>
                    
                    <div className="text-xs text-muted-foreground">
                      <div className="flex items-start gap-1">
                        <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                        <span>
                          For the Pix2Struct → Ollama data flow to work: 
                          1. Backend must be running (python app.py)
                          2. Ollama must be running (ollama serve)
                          3. At least one model must be available
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="logs" className="mt-2">
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm">Debug Logs</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-64 w-full rounded border p-2">
                      <pre className="text-xs font-mono whitespace-pre-wrap">
                        {logs.length > 0 ? 
                          logs.join('\n') : 
                          'No logs captured yet.'
                        }
                      </pre>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default DebugPanel;
