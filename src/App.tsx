import React, { useEffect, useState } from 'react';
import { Header } from './components/Header';
import { ProviderCard } from './components/ProviderCard';
import { CommandPalette } from './components/CommandPalette';
import { RequestHistory } from './components/RequestHistory';
import { useProviders } from './hooks/useProviders';
import { useCommands } from './hooks/useCommands';
import { useMCPRequests } from './hooks/useMCPRequests';
import { WorkflowBuilder } from './components/WorkflowBuilder';
import { GoogleConnect } from './components/GoogleConnect';
import { GitHubConnect } from './components/GitHubConnect';
import { SmartChat } from './components/SmartChat';
import { SettingsModal } from './components/SettingsModal';
import { CommandList } from './components/CommandList';
import { ChromeGrid } from '@/components/ui/chrome-grid';

interface WorkflowStep {
  provider: string;
  command: string;
  prompt: string;
  apiKey?: string;
}

function App() {
  const { providers, setApiKey, updateProvider } = useProviders();
  const { commands } = useCommands();
  const { requests, loading, executeCommand, clearHistory } = useMCPRequests();
  const [contextHistory, setContextHistory] = useState<{ prompt: string; response: string }[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showCommands, setShowCommands] = useState(false);
  const [chatInput, setChatInput] = useState('');

  // Move dark mode state to be passed to Header
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('mcp-dark-mode') === 'true' || window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('mcp-dark-mode', 'true');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('mcp-dark-mode', 'false');
    }
  }, [darkMode]);

  const handleExecuteCommand = async (prompt: string, provider: string, apiKey: string, command: string) => {
    await executeCommand(prompt, provider, apiKey, command);
    
    // Update request count
    updateProvider(provider, { 
      requestCount: (providers.find(p => p.id === provider)?.requestCount || 0) + 1,
      lastUsed: new Date()
    });
  };

  const handleRunWorkflow = async (workflow: WorkflowStep[], onStepResult?: (idx: number, status: 'running' | 'success' | 'error', output?: string) => void) => {
    try {
      const res = await fetch('http://localhost:3001/api/workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflow }),
        credentials: 'include',
      });
      const data = await res.json();
      if (data.results && Array.isArray(data.results)) {
        let lastPrompt = '';
        data.results.forEach((result: any, idx: number) => {
          if (onStepResult) {
            if (result.error) {
              onStepResult(idx, 'error', result.error);
            } else {
              onStepResult(idx, 'success', result.output || '[No output]');
            }
          }
          setContextHistory(prev => [
            ...prev,
            {
              prompt: workflow[idx]?.prompt || lastPrompt,
              response: result.output || result.error || '[No output]'
            }
          ]);
          lastPrompt = workflow[idx]?.prompt || lastPrompt;
        });
      } else {
        if (onStepResult) {
          for (let i = 0; i < workflow.length; i++) {
            onStepResult(i, 'error', data.error || '[Unknown error]');
          }
        }
        setContextHistory(prev => [
          ...prev,
          { prompt: '[Workflow error]', response: data.error || '[Unknown error]' }
        ]);
      }
    } catch (err: any) {
      if (onStepResult) {
        for (let i = 0; i < workflow.length; i++) {
          onStepResult(i, 'error', err.message || '[Network error]');
        }
      }
      setContextHistory(prev => [
        ...prev,
        { prompt: '[Workflow error]', response: err.message || '[Network error]' }
      ]);
    }
  };

  const handleInsertGoogleContent = (content: string) => {
    // Prefill the prompt of the first workflow step (or you can add a new step)
    setContextHistory(prev => [...prev, { prompt: '[Google Content]', response: content }]);
  };

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
  const handleInsertCommand = (example: string) => {
    setChatInput(example);
    setShowCommands(false);
  };

  return (
    <div className={
      `relative min-h-screen w-screen overflow-hidden transition-colors duration-300 ` +
      (darkMode ? 'dark bg-neutral-950 text-neutral-100' : 'bg-gradient-to-br from-neutral-100 via-white to-neutral-200 text-gray-900')
    }>
      {/* ChromeGrid 3D background */}
      <div className="absolute inset-0 z-0">
        <ChromeGrid />
      </div>
      {/* App content overlay - allow pointer events only on interactive children */}
      <div className="relative z-10 pointer-events-none">
        <div className="pointer-events-auto">
          <Header onSettings={() => setShowSettings(true)} darkMode={darkMode} setDarkMode={setDarkMode} />
        </div>
        <main className="flex flex-col items-center w-full pointer-events-auto">
          <div className="w-full max-w-2xl">
            <SmartChat providers={providers} inputValue={chatInput} setInputValue={setChatInput} inputPlaceholder="Type a message or try: 'Summarize this repo and create a GitHub issue: Login bug'" />
          </div>
          <div className="w-full max-w-2xl mt-4 mb-2">
            <div className="text-sm text-gray-500 dark:text-gray-300 flex items-center gap-2 p-2 bg-white/70 dark:bg-neutral-800 rounded-lg shadow">
              <span>
                <strong>Tip:</strong> Try multi-step commands like <code>Summarize this repo and create a GitHub issue: Login bug</code> or <code>List my GitHub repos and summarize the most active one</code>.<br />
                You can also use single-step commands like <code>Summarize this document and translate to Spanish</code>.
              </span>
              <span title="MCP commands let you chain actions like summarizing, translating, or creating issues across providers." className="cursor-help text-blue-500">?</span>
            </div>
          </div>
        </main>
        <div className="pointer-events-auto">
          <SettingsModal
            open={showSettings}
            onClose={() => setShowSettings(false)}
            providers={providers}
            onSetApiKey={setApiKey}
            onShowCommands={() => { setShowSettings(false); setShowCommands(true); }}
          />
          <CommandList
            open={showCommands}
            commands={mcpCommands}
            onInsert={handleInsertCommand}
            onClose={() => setShowCommands(false)}
          />
        </div>
      </div>
    </div>
  );
}

export default App;