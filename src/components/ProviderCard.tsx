import React, { useState } from 'react';
import { Provider } from '../types';
import { Bot, Zap, Sparkles, Settings, Eye, EyeOff, Globe, Heart } from 'lucide-react';

interface ProviderCardProps {
  provider: Provider;
  onUpdateApiKey: (providerId: string, apiKey: string) => void;
  onSetStatus?: (providerId: string, status: Provider['status']) => void;
}

const iconMap = {
  Bot,
  Zap,
  Sparkles,
  Globe,
  Heart,
};

export const ProviderCard: React.FC<ProviderCardProps> = ({ provider, onUpdateApiKey, onSetStatus = () => {} }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [tempApiKey, setTempApiKey] = useState(provider.apiKey || '');
  const [testing, setTesting] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);

  const IconComponent = iconMap[provider.icon as keyof typeof iconMap] || Bot;

  const handleSave = () => {
    onUpdateApiKey(provider.id, tempApiKey);
    onSetStatus(provider.id, 'connected');
    setIsEditing(false);
    setShowApiKey(false);
  };

  const handleCancel = () => {
    setTempApiKey(provider.apiKey || '');
    setIsEditing(false);
    setShowApiKey(false);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestError(null);
    try {
      const resp = await fetch('http://localhost:3001/api/validate-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: provider.id, apiKey: tempApiKey })
      });
      const data = await resp.json();
      if (data.valid) {
        // success: call onUpdateApiKey to persist and mark connected
        onUpdateApiKey(provider.id, tempApiKey);
        onSetStatus(provider.id, 'connected');
        setTestError(null);
      } else {
        setTestError(data.error || 'Invalid key');
        onSetStatus(provider.id, 'error');
      }
    } catch (err: any) {
      setTestError(err.message);
    } finally {
      setTesting(false);
    }
  };

  const getStatusColor = () => {
    switch (provider.status) {
      case 'connected': return 'text-green-500';
      case 'error': return 'text-red-500';
      case 'pending': return 'text-yellow-500';
      default: return 'text-gray-400';
    }
  };

  const getStatusDot = () => {
    switch (provider.status) {
      case 'connected': return 'bg-green-500';
      case 'error': return 'bg-red-500';
      case 'pending': return 'bg-yellow-500';
      default: return 'bg-gray-400';
    }
  };

  return (
    <div className="bg-white/70 dark:bg-neutral-900 dark:border-neutral-700 backdrop-blur-sm rounded-xl p-6 border border-gray-200 hover:shadow-lg transition-all duration-300">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className={`p-3 rounded-lg bg-gradient-to-br ${provider.color}`}>
            <IconComponent className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{provider.name}</h3>
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${getStatusDot()}`} />
              <span className={`text-sm capitalize ${getStatusColor()}`}>
                {provider.status}
              </span>
            </div>
          </div>
        </div>
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <Settings className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      {provider.requestCount !== undefined && (
        <div className="mb-4">
          <div className="text-sm text-gray-600">Requests this session</div>
          <div className="text-2xl font-bold text-gray-900">{provider.requestCount}</div>
        </div>
      )}

      {isEditing && (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              API Key
            </label>
            <div className="relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={tempApiKey}
                onChange={(e) => setTempApiKey(e.target.value)}
                placeholder="Enter your API key"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex space-x-2">
              <button
                onClick={handleTest}
                className="bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                disabled={testing || !tempApiKey}
              >
                {testing ? 'Testing...' : 'Test'}
              </button>
              <button
                onClick={handleSave}
                className="flex-1 bg-neutral-800 text-white px-4 py-2 rounded-lg hover:bg-neutral-900 transition-colors"
              >
                Save
              </button>
              <button
                onClick={handleCancel}
                className="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
            {testError && <div className="text-xs text-red-500">{testError}</div>}
          </div>
        </div>
      )}
    </div>
  );
};