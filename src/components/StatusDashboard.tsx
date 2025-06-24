
import { useState } from "react";
import { 
  Server, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw, 
  Database, 
  Monitor, 
  Brain 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type ServiceStatus = "online" | "offline" | "checking";

interface StatusDashboardProps {
  onClose: () => void;
  backendStatus: boolean | null;
  ollamaStatus: boolean | null;
  availableModels: string[];
  onRefresh: () => void;
  statusMessage?: string | null;
}

const StatusDashboard = ({ 
  onClose, 
  backendStatus: propBackendStatus,
  ollamaStatus: propOllamaStatus,
  availableModels: propAvailableModels,
  onRefresh,
  statusMessage
}: StatusDashboardProps) => {
  const [isChecking, setIsChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(new Date());
  
  const backendStatus: ServiceStatus = 
    propBackendStatus === null ? "checking" : 
    propBackendStatus ? "online" : "offline";
    
  const ollamaStatus: ServiceStatus = 
    propOllamaStatus === null ? "checking" : 
    propOllamaStatus ? "online" : "offline";
    
  const frontendStatus: ServiceStatus = "online";

  const refreshStatus = async () => {
    try {
      setIsChecking(true);
      await onRefresh();
      setLastChecked(new Date());
    } catch (error) {
      console.error("Error refreshing status:", error);
      toast.error("Failed to check service status");
    } finally {
      setIsChecking(false);
    }
  };

  const getStatusBadge = (status: ServiceStatus) => {
    switch (status) {
      case "online":
        return <Badge variant="success" className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" /> Online</Badge>;
      case "offline":
        return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" /> Offline</Badge>;
      case "checking":
        return <Badge variant="outline" className="animate-pulse"><RefreshCw className="w-3 h-3 mr-1 animate-spin" /> Checking</Badge>;
    }
  };

  const renderSetupInstructions = () => {
    if (backendStatus === "online" && ollamaStatus === "online") return null;
    
    return (
      <div className="mt-4 p-4 rounded-md bg-muted/50 text-sm space-y-3">
        <h3 className="font-semibold">Setup Instructions:</h3>
        
        {backendStatus === "offline" && (
          <div className="space-y-1">
            <h4 className="font-medium text-amber-600 flex items-center">
              <Server className="h-4 w-4 mr-1" /> Backend Setup
            </h4>
            <ol className="list-decimal ml-5 text-xs space-y-1">
              <li>Navigate to the backend folder in your terminal</li>
              <li>Run <code className="bg-muted px-1 rounded">pip install -r requirements.txt</code> (first time only)</li>
              <li>Start the backend with <code className="bg-muted px-1 rounded">python app.py</code></li>
            </ol>
          </div>
        )}
        
        {backendStatus === "online" && ollamaStatus === "offline" && (
          <div className="space-y-1">
            <h4 className="font-medium text-amber-600 flex items-center">
              <Brain className="h-4 w-4 mr-1" /> Ollama Setup
            </h4>
            <ol className="list-decimal ml-5 text-xs space-y-1">
              <li>Install Ollama from <a href="https://ollama.ai" className="text-blue-600 hover:underline" target="_blank" rel="noopener">ollama.ai</a></li>
              <li>Start Ollama with <code className="bg-muted px-1 rounded">ollama serve</code></li>
              <li>Pull a model with <code className="bg-muted px-1 rounded">ollama pull llama3</code></li>
            </ol>
          </div>
        )}
      </div>
    );
  };

  return (
    <Card className="w-[350px]">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>System Status</span>
          <Button variant="ghost" size="icon" onClick={refreshStatus} disabled={isChecking}>
            <RefreshCw className={`h-4 w-4 ${isChecking ? 'animate-spin' : ''}`} />
          </Button>
        </CardTitle>
        <CardDescription>
          Check the status of all required services
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-[24px_1fr_80px] items-center gap-3">
          <Monitor className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">Frontend</p>
            <p className="text-xs text-muted-foreground">React Application</p>
          </div>
          {getStatusBadge(frontendStatus)}
        </div>
        
        <Separator />
        
        <div className="grid grid-cols-[24px_1fr_80px] items-center gap-3">
          <Server className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">Backend</p>
            <p className="text-xs text-muted-foreground">Flask API</p>
          </div>
          {getStatusBadge(backendStatus)}
        </div>
        
        <Separator />
        
        <div className="grid grid-cols-[24px_1fr_80px] items-center gap-3">
          <Brain className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">Ollama</p>
            <p className="text-xs text-muted-foreground">LLM Service</p>
          </div>
          {getStatusBadge(ollamaStatus)}
        </div>
        
        {propAvailableModels.length > 0 && (
          <div className="mt-2">
            <p className="text-xs font-medium mb-1">Available Models:</p>
            <div className="flex flex-wrap gap-1">
              {propAvailableModels.map((model, idx) => (
                <Badge key={idx} variant="outline" className="text-xs">{model}</Badge>
              ))}
            </div>
          </div>
        )}
        
        {statusMessage && (
          <div className="mt-2 text-xs text-amber-600">
            <p>{statusMessage}</p>
          </div>
        )}
        
        {renderSetupInstructions()}
        
        {lastChecked && (
          <p className="text-xs text-muted-foreground mt-2">
            Last checked: {lastChecked.toLocaleTimeString()}
          </p>
        )}
      </CardContent>
      <CardFooter>
        <Button variant="outline" className="w-full" onClick={onClose}>
          Close
        </Button>
      </CardFooter>
    </Card>
  );
};

export default StatusDashboard;
