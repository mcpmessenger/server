import React, { useEffect, useState } from 'react';
import { Header } from './components/Header';
import { SettingsModalNew as SettingsModal } from './components/SettingsModalNew';
import { CommandList } from './components/CommandList';
import { ChromeGrid } from './components/ui/chrome-grid';
import { useProviders } from './hooks/useProviders';
import { ServerLogTicker } from './components/ServerLogTicker';

function App() {
  const { providers, setApiKey, setStatus } = useProviders();
  const [showSettings, setShowSettings] = useState(false);
  const [showCommands, setShowCommands] = useState(false);
  // Global ticker showing last command executed
  const [ticker, setTicker] = useState<string>('');

  // Force dark mode once on mount (no toggle)
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  useEffect(() => {
    const handler = (e: any) => setTicker(e.detail as string);
    window.addEventListener('mcp-run', handler);
    return () => window.removeEventListener('mcp-run', handler);
  }, []);

  // Example command registry
  const mcpCommands = [
    { id: 'chat', name: 'Chat', description: 'Conversational AI', example: 'Chat: What is the MCP protocol?' },
    { id: 'summarize', name: 'Summarize', description: 'Summarize text or files', example: 'Summarize this file' },
    { id: 'repo-summary', name: 'Repo Summary', description: 'Summarize a GitHub repo', example: 'Repo summary for my-app' },
    { id: 'code-search', name: 'Code Search', description: 'Search code in your repos', example: 'Code search for login function' },
    { id: 'generate-issue', name: 'Generate Issue', description: 'Draft a GitHub issue', example: 'Create a GitHub issue: Login page is broken' },
    { id: 'generate-pr', name: 'Generate PR', description: 'Draft a GitHub pull request', example: 'Create a pull request for feature X' },
    { id: 'explain', name: 'Explain', description: 'Explain code or text', example: 'Explain this code' },
    { id: 'translate', name: 'Translate', description: 'Translate text', example: 'Translate this to Spanish' },
  ];

  // Handler for quick-insert from CommandList
  const handleInsertCommand = (_example: string) => {
    setShowCommands(false);
  };

  return (
    <div className={
      'relative min-h-screen w-screen overflow-hidden dark bg-neutral-950 text-neutral-100'
    }>
      {/* ChromeGrid 3D background */}
      <div className="absolute inset-0 z-0">
        <ChromeGrid />
      </div>
      {/* App content overlay - allow pointer events only on interactive children */}
      <div className="relative z-10 pointer-events-none">
        <div className="pointer-events-auto">
          <Header />
        </div>
        <main className="flex flex-col items-center w-full pointer-events-auto">
          {/* Main content currently has no SmartChat UI */}
        </main>
        <div className="pointer-events-auto">
          <SettingsModal
            open={showSettings}
            onClose={() => setShowSettings(false)}
            providers={providers}
            onSetApiKey={setApiKey}
            onSetStatus={setStatus}
          />
          <CommandList
            open={showCommands}
            commands={mcpCommands}
            onInsert={handleInsertCommand}
            onClose={() => setShowCommands(false)}
          />
        </div>
        {/* Ticker overlay */}
        {ticker && (
          <div className="fixed bottom-5 right-6 z-50 bg-black/80 text-white text-xs px-3 py-1 rounded shadow-lg pointer-events-none select-none">
            {ticker}
          </div>
        )}
        {/* Live server console logs */}
        <ServerLogTicker />
      </div>
    </div>
  );
}

export default App;