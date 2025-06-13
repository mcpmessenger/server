import React, { useEffect, useState } from 'react';
import { Activity, Globe, Settings, Moon, Sun, MinusCircle, Bot, Zap, Sparkles, Github } from 'lucide-react';
import { useProviders } from '../hooks/useProviders';

export const Header: React.FC<{
  onSettings?: () => void;
  darkMode: boolean;
  setDarkMode: (val: boolean) => void;
  onMinimizeChat?: () => void;
  onGoogleConnect?: () => void;
  onGitHubConnect?: () => void;
}> = ({ onSettings, darkMode, setDarkMode, onMinimizeChat, onGoogleConnect, onGitHubConnect }) => {
  const [serverOnline, setServerOnline] = useState(true);
  const { providers } = useProviders();

  // Map provider icon string to Lucide icon
  const iconMap = { Bot, Zap, Sparkles, Github, Globe };

  // Carousel click handlers
  const handleIconClick = (id: string) => {
    if (id === 'google' && onGoogleConnect) onGoogleConnect();
    else if (id === 'github' && onGitHubConnect) onGitHubConnect();
    else if (id === 'settings' && onSettings) onSettings();
    // Add more as needed
  };

  useEffect(() => {
    const checkHealth = () => {
      fetch('http://localhost:3001/api/health')
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
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">MCP Server</h1>
                <p className="text-sm text-gray-500 dark:text-gray-300">Model Context Protocol</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-300">
                <Globe className="w-4 h-4" />
                <span>{serverOnline ? 'Server: Running' : 'Server: Offline'}</span>
                <div className={`w-2 h-2 rounded-full animate-pulse ${serverOnline ? 'bg-green-500' : 'bg-red-500'}`} />
              </div>
              <button
                className="p-2 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
                onClick={() => setDarkMode(!darkMode)}
                aria-label="Toggle dark mode"
              >
                {darkMode ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5 text-gray-600" />}
              </button>
              <button
                className="p-2 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
                onClick={onMinimizeChat}
                aria-label="Minimize chat"
              >
                <MinusCircle className="w-5 h-5 text-gray-600 dark:text-gray-300" />
              </button>
              <button
                className="p-2 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
                onClick={onSettings}
                aria-label="Settings"
              >
                <Settings className="w-5 h-5 text-gray-600 dark:text-gray-300" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};