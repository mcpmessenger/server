import React, { useEffect, useState } from 'react';
import { Activity, Globe, Settings, MinusCircle } from 'lucide-react';

export const Header: React.FC<{
  onSettings?: () => void;
  onMinimizeChat?: () => void;
  onGoogleConnect?: () => void;
  onGitHubConnect?: () => void;
}> = ({ onSettings, onMinimizeChat, onGoogleConnect, onGitHubConnect }) => {
  const [serverOnline, setServerOnline] = useState(true);

  useEffect(() => {
    const apiBase = import.meta.env.VITE_MCP_API || '';
    const checkHealth = () => {
      fetch(`${apiBase}/api/health`)
        .then(res => res.ok ? setServerOnline(true) : setServerOnline(false))
        .catch(() => setServerOnline(false));
    };
    checkHealth();
    const interval = setInterval(checkHealth, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md border-b border-gray-200 dark:border-neutral-800 sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">Slash / MCP Server</h1>
                <p className="text-sm text-gray-500 dark:text-gray-300">Model Context Protocol</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-300">
                <Globe className="w-4 h-4" />
                <span>{serverOnline ? 'Server: Running' : 'Server: Offline'}</span>
                <div className={`w-2 h-2 rounded-full animate-pulse ${serverOnline ? 'bg-green-500' : 'bg-red-500'}`} />
              </div>
              {onMinimizeChat && (
                <button
                  className="p-2 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
                  onClick={onMinimizeChat}
                  aria-label="Minimize chat"
                >
                  <MinusCircle className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                </button>
              )}
              {onSettings && (
                <button
                  className="p-2 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
                  onClick={onSettings}
                  aria-label="Settings"
                >
                  <Settings className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};