import React, { useState, useRef, useEffect } from 'react';
import { Command, Provider } from '../types';
import { Send, Loader2, Terminal } from 'lucide-react';

interface CommandPaletteProps {
  providers: Provider[];
  commands: Command[];
  onExecute: (prompt: string, provider: string, apiKey: string, command: string) => Promise<void>;
  loading: boolean;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  providers,
  commands,
  onExecute,
  loading
}) => {
  const [prompt, setPrompt] = useState('');
  const [selectedProvider, setSelectedProvider] = useState('');
  const [selectedCommand, setSelectedCommand] = useState(commands[0]?.id || 'chat');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const connectedProviders = providers.filter(p => p.status === 'connected');

  useEffect(() => {
    if (connectedProviders.length > 0 && !selectedProvider) {
      setSelectedProvider(connectedProviders[0].id);
    }
  }, [connectedProviders, selectedProvider]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || !selectedProvider || loading) return;

    const provider = providers.find(p => p.id === selectedProvider);
    if (!provider?.apiKey) return;

    try {
      await onExecute(prompt, selectedProvider, provider.apiKey, selectedCommand);
      setPrompt('');
    } catch (error) {
      console.error('Command execution failed:', error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const formatPlaceholder = () => {
    if (!selectedProvider) return 'Select a provider first...';
    return `Enter your command (e.g., /${selectedProvider} chat Hello, world!)`;
  };

  return (
    <div className="bg-white/70 backdrop-blur-sm rounded-xl p-6 border border-gray-200">
      <div className="flex items-center space-x-3 mb-4">
        <Terminal className="w-5 h-5 text-gray-600" />
        <h2 className="text-lg font-semibold text-gray-900">Command Palette</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex space-x-3">
          <select
            value={selectedProvider}
            onChange={(e) => setSelectedProvider(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-32"
            disabled={loading}
          >
            <option value="">Select Provider</option>
            {connectedProviders.map(provider => (
              <option key={provider.id} value={provider.id}>
                {provider.name}
              </option>
            ))}
          </select>

          <select
            value={selectedCommand}
            onChange={(e) => setSelectedCommand(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent min-w-32"
            disabled={loading}
          >
            {commands.map(command => (
              <option key={command.id} value={command.id}>
                {command.name}
              </option>
            ))}
          </select>

          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={formatPlaceholder()}
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              disabled={loading || connectedProviders.length === 0}
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-500">
            Available commands: {commands.map(c => c.name).join(', ')}
          </div>
          <button
            type="submit"
            disabled={!prompt.trim() || !selectedProvider || loading || connectedProviders.length === 0}
            className="flex items-center space-x-2 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            <span>{loading ? 'Executing...' : 'Execute'}</span>
          </button>
        </div>
      </form>

      {connectedProviders.length === 0 && (
        <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            Please configure at least one provider to start executing commands.
          </p>
        </div>
      )}
    </div>
  );
};