
import React, { useState, useEffect } from 'react';
import { getStatus, testOllamaConnection } from './services/backendService'; 

const ChatInterface: React.FC = () => {
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [backendAvailable, setBackendAvailable] = useState<boolean | null>(null);
    const [ollamaAvailable, setOllamaAvailable] = useState<boolean | null>(null);
    const [connectionMessage, setConnectionMessage] = useState<string>('Checking connections...');
    const [isChecking, setIsChecking] = useState<boolean>(false);

    // Check backend and Ollama connectivity on mount
    useEffect(() => {
        checkConnections();
        
        // Check connections every 60 seconds instead of 30
        const interval = setInterval(checkConnections, 60000);
        
        return () => clearInterval(interval);
    }, []);
    
    const checkConnections = async () => {
        // Prevent multiple simultaneous checks
        if (isChecking) return;
        
        try {
            setIsChecking(true);
            // Clear previous errors
            setErrorMessage(null);
            
            // First check backend
            const backendStatus = await getStatus();
            setBackendAvailable(true);
            
            // Then check Ollama if backend is available
            try {
                const ollamaResult = await testOllamaConnection();
                setOllamaAvailable(ollamaResult.success);
                
                if (ollamaResult.success) {
                    setConnectionMessage('Backend and Ollama connections established');
                } else {
                    setConnectionMessage(`Backend connected, but Ollama is not available: ${ollamaResult.message}`);
                }
            } catch (ollamaError) {
                setOllamaAvailable(false);
                setConnectionMessage('Backend connected, but Ollama check failed');
            }
        } catch (backendError) {
            setBackendAvailable(false);
            setOllamaAvailable(false);
            setConnectionMessage('Unable to connect to backend');
            
            if (backendError instanceof Error) {
                setErrorMessage(backendError.message);
            } else {
                setErrorMessage("An unknown error occurred connecting to backend.");
            }
        } finally {
            setIsChecking(false);
        }
    };

    const handleBackendRequest = async () => {
        try {
            setErrorMessage(null); // Clear previous errors
            const status = await getStatus();
        } catch (error) {
            if (error instanceof Error) {
                setErrorMessage(error.message);
            } else {
                setErrorMessage("An unknown error occurred.");
            }
        }
    };

    return (
        <div className="p-4 bg-background rounded-lg shadow">
            <div className="mb-4 flex flex-col space-y-2">
                <h2 className="text-xl font-semibold">Connection Status</h2>
                <div className="flex items-center space-x-2">
                    <div className={`w-3 h-3 rounded-full ${
                        backendAvailable === null ? 'bg-gray-300' :
                        backendAvailable ? 'bg-green-500' : 'bg-red-500'
                    }`}></div>
                    <span>Backend: {backendAvailable === null ? 'Checking...' : 
                        backendAvailable ? 'Connected' : 'Disconnected'}</span>
                </div>
                
                <div className="flex items-center space-x-2">
                    <div className={`w-3 h-3 rounded-full ${
                        ollamaAvailable === null ? 'bg-gray-300' :
                        ollamaAvailable ? 'bg-green-500' : 'bg-red-500'
                    }`}></div>
                    <span>Ollama: {ollamaAvailable === null ? 'Checking...' : 
                        ollamaAvailable ? 'Connected' : 'Disconnected'}</span>
                </div>
                
                <p className="text-sm text-muted-foreground">{connectionMessage}</p>
                
                {errorMessage && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded">
                        {errorMessage}
                    </div>
                )}
            </div>
            
            <div className="flex space-x-2">
                <button 
                    className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
                    onClick={handleBackendRequest}
                >
                    Check Backend Status
                </button>
                
                <button 
                    className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded"
                    onClick={checkConnections}
                    disabled={isChecking}
                >
                    {isChecking ? 'Checking...' : 'Verify Connections'}
                </button>
            </div>
        </div>
    );
};

export default ChatInterface;
