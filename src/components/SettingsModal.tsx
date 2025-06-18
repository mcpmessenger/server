import React, { useEffect, useState } from 'react';
import { ProviderCard } from './ProviderCard';
import { Provider } from '../types';
import { Bot, Zap, Sparkles, Github, Globe, Link, Key, Webhook } from 'lucide-react';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  providers: Provider[];
  onSetApiKey: (providerId: string, apiKey: string) => void;
  onShowCommands: () => void;
}

interface Webhook {
  id: number;
  name: string;
  url: string;
  type: string;
  secret?: string;
}

// Example help links for each provider
const HELP_LINKS: { [key: string]: string } = {
  openai: 'https://platform.openai.com/account/api-keys',
  anthropic: 'https://console.anthropic.com/settings/keys',
  google: 'https://console.cloud.google.com/apis/credentials',
  github: 'https://github.com/settings/tokens',
  zapier: 'https://platform.zapier.com/docs/triggers/#webhooks',
  n8n: 'https://docs.n8n.io/integrations/builtin/webhook/',
  cohere: 'https://dashboard.cohere.com/api-keys',
  mistral: 'https://docs.mistral.ai/platform/api-keys/',
  perplexity: 'https://www.perplexity.ai/settings/api',
  'azure-openai': 'https://learn.microsoft.com/en-us/azure/ai-services/openai/how-to/create-resource?pivots=web-portal',
};

const initialTempKeys = (providers: Provider[]) => Object.fromEntries(providers.map(p => [p.id, p.apiKey || '']));

export const SettingsModal: React.FC<SettingsModalProps> = ({ open, onClose, providers, onSetApiKey, onShowCommands }) => {
  const [githubConnected, setGithubConnected] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [zapierUrl, setZapierUrl] = useState('');
  const [zapierSecret, setZapierSecret] = useState('');
  const [n8nUrl, setN8nUrl] = useState('');
  const [n8nSecret, setN8nSecret] = useState('');
  const [webhookError, setWebhookError] = useState<string | null>(null);
  const [tempKeys, setTempKeys] = useState<{ [id: string]: string }>(() => initialTempKeys(providers));
  const [keyStatus, setKeyStatus] = useState<{ [id: string]: 'connected' | 'disconnected' | 'error' | 'checking' | 'pending' }>({});
  const [keyError, setKeyError] = useState<{ [id: string]: string }>({});
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [newWebhook, setNewWebhook] = useState<{ name: string; url: string; type: string; secret?: string }>({ name: '', url: '', type: 'zapier', secret: '' });
  const [addError, setAddError] = useState<string | null>(null);
  const [zapierSaved, setZapierSaved] = useState(false);
  const [zapierSaving, setZapierSaving] = useState(false);

  const fetchStatuses = () => {
    fetch('http://localhost:3001/api/github/status', { credentials: 'include' })
      .then(res => res.json())
      .then(data => setGithubConnected(!!data.connected))
      .catch(() => setGithubConnected(false));
    fetch('http://localhost:3001/api/google/status', { credentials: 'include' })
      .then(res => res.json())
      .then(data => setGoogleConnected(!!data.connected))
      .catch(() => setGoogleConnected(false));
  };

  const fetchWebhooks = async () => {
    try {
      const res = await fetch('/api/user/webhooks', { credentials: 'include' });
      const data = await res.json();
      setWebhooks(data.webhooks || []);
    } catch (err) {
      setAddError('Failed to fetch webhooks.');
    }
  };

  useEffect(() => {
    if (open) {
      fetch('/api/user/webhooks', { credentials: 'include' })
        .then(async res => {
          if (!res.ok) throw new Error(await res.text());
          return res.json();
        })
        .then(data => {
          setZapierUrl(data.zapierUrl || '');
          setZapierSecret(data.zapierSecret || '');
          setN8nUrl(data.n8nUrl || '');
          setN8nSecret(data.n8nSecret || '');
          setWebhookError(null);
        })
        .catch(err => {
          setWebhookError('Could not load webhook settings. Please sign in.');
        });
      fetchWebhooks();
    }
    setTempKeys(initialTempKeys(providers));
    setKeyStatus(Object.fromEntries(providers.map(p => [p.id, p.apiKey ? p.status : 'disconnected'])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, providers]);

  const handleGitHubConnect = () => {
    window.open('http://localhost:3001/auth/github', '_blank');
    setTimeout(fetchStatuses, 2000);
  };
  const handleGoogleConnect = () => {
    window.open('http://localhost:3001/auth/google', '_blank');
    setTimeout(fetchStatuses, 2000);
  };
  const handleGitHubDisconnect = async () => {
    await fetch('http://localhost:3001/api/github/disconnect', { credentials: 'include', method: 'POST' });
    fetchStatuses();
  };
  const handleGoogleDisconnect = async () => {
    await fetch('http://localhost:3001/api/google/disconnect', { credentials: 'include', method: 'POST' });
    fetchStatuses();
  };

  const validateApiKey = async (providerId: string, apiKey: string) => {
    if (!apiKey) return { status: 'disconnected', error: '' };
    const res = await fetch('/api/validate/provider', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: providerId, apiKey })
    });
    const data = await res.json();
    if (data.success) return { status: 'connected', error: '' };
    return { status: 'error', error: data.error || 'Invalid API key.' };
  };

  const handleSaveKey = async (providerId: string) => {
    const apiKey = tempKeys[providerId];
    setKeyStatus(s => ({ ...s, [providerId]: 'checking' as const }));
    const { status, error } = await validateApiKey(providerId, apiKey);
    setKeyStatus(s => ({ ...s, [providerId]: status as typeof keyStatus[string] }));
    setKeyError(e => ({ ...e, [providerId]: error }));
    if (status === 'connected') {
      onSetApiKey(providerId, apiKey);
    }
  };

  const handleDeleteKey = (providerId: string) => {
    setTempKeys(k => ({ ...k, [providerId]: '' }));
    setKeyStatus(s => ({ ...s, [providerId]: 'disconnected' as const }));
    setKeyError(e => ({ ...e, [providerId]: '' }));
    onSetApiKey(providerId, '');
  };

  const onSaveZapier = async (url: string, secret: string) => {
    setWebhookError(null);
    setZapierSaving(true);
    setZapierSaved(false);
    const res = await fetch('/api/validate/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    const data = await res.json();
    if (!data.success) {
      setWebhookError('Invalid Zapier webhook: ' + (data.error || 'Unknown error'));
      setZapierSaving(false);
      setZapierSaved(false);
      return;
    }
    fetch('/api/user/webhooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        name: 'default',
        url,
        type: 'zapier',
        secret
      })
    })
      .then(async res => {
        if (!res.ok) throw new Error(await res.text());
        setWebhookError(null);
        setZapierSaved(true);
      })
      .catch(err => {
        setWebhookError('Failed to save Zapier settings.');
        setZapierSaved(false);
      })
      .finally(() => {
        setZapierSaving(false);
      });
    setZapierUrl(url);
    setZapierSecret(secret);
  };

  const onSaveN8n = async (url: string, secret: string) => {
    setWebhookError(null);
    const res = await fetch('/api/validate/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    const data = await res.json();
    if (!data.success) {
      setWebhookError('Invalid n8n webhook: ' + (data.error || 'Unknown error'));
      return;
    }
    fetch('/api/user/webhooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        zapierUrl,
        zapierSecret,
        n8nUrl: url,
        n8nSecret: secret
      })
    })
      .then(async res => {
        if (!res.ok) throw new Error(await res.text());
        setWebhookError(null);
      })
      .catch(err => {
        setWebhookError('Failed to save n8n settings.');
      });
    setN8nUrl(url);
    setN8nSecret(secret);
  };

  const handleAddWebhook = async () => {
    setAddError(null);
    // Validate webhook before saving
    const res = await fetch('/api/validate/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: newWebhook.url })
    });
    const data = await res.json();
    if (!data.success) {
      setAddError('Invalid webhook: ' + (data.error || 'Unknown error'));
      return;
    }
    // Save webhook
    const saveRes = await fetch('/api/user/webhooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(newWebhook)
    });
    if (!saveRes.ok) {
      setAddError('Failed to save webhook.');
      return;
    }
    setNewWebhook({ name: '', url: '', type: 'zapier', secret: '' });
    fetchWebhooks();
  };

  const handleDeleteWebhook = async (id: number) => {
    await fetch(`/api/user/webhooks/${id}`, { method: 'DELETE', credentials: 'include' });
    fetchWebhooks();
  };

  if (!open) return null;
  // Close when clicking the overlay background (outside the modal box)
  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };
  // Unified settings items: providers + integrations
  const githubProvider = providers.find(p => p.id === 'github');
  const githubStatus = githubProvider?.apiKey ? 'connected' : 'disconnected';
  const integrationItems = [
    {
      id: 'github',
      name: 'GitHub',
      icon: <Github className="w-6 h-6 text-white" />,
      color: 'from-gray-700 to-black',
      status: githubStatus,
      action: (
        <div className="flex flex-col gap-2 w-full">
          <input
            type="password"
            className={`w-full rounded border px-2 py-1 bg-white dark:bg-neutral-900 border-gray-300 dark:border-neutral-700 ${keyError['github'] && keyError['github'] !== 'Provider not supported for validation.' ? 'border-red-500' : ''}`}
            placeholder="GitHub Token"
            value={tempKeys['github'] || ''}
            onChange={e => setTempKeys(k => ({ ...k, ['github']: e.target.value }))}
          />
          <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer" className="text-blue-500 underline text-xs">How to get a GitHub token?</a>
          {keyError['github'] && keyError['github'] !== 'Provider not supported for validation.' && (
            <div className="text-red-500 text-xs">{keyError['github']}</div>
          )}
          {githubProvider?.apiKey && (
            <div className="text-green-600 text-xs">Token saved. GitHub commands are ready to use.</div>
          )}
          <div className="flex space-x-2 mt-1">
            <button
              className="flex-1 bg-neutral-800 text-white px-4 py-2 rounded-lg hover:bg-neutral-900 transition-colors text-sm"
              onClick={() => handleSaveKey('github')}
              type="button"
            >
              Save
            </button>
            <button
              className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors text-sm"
              onClick={() => handleDeleteKey('github')}
              type="button"
            >
              Delete
            </button>
          </div>
        </div>
      )
    },
    {
      id: 'google',
      name: 'Google',
      icon: <Globe className="w-6 h-6 text-white" />,
      color: 'from-green-400 to-blue-500',
      status: googleConnected ? 'connected' : 'disconnected',
      action: (
        <div className="flex flex-col gap-2">
          <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="text-blue-500 underline text-xs">How to connect Google?</a>
        </div>
      )
    },
    {
      id: 'google_calendar',
      name: 'Google Calendar',
      icon: <Globe className="w-6 h-6 text-white" />,
      color: 'from-green-400 to-blue-500',
      status: googleConnected ? 'connected' : 'disconnected',
      action: (
        <div className="text-xs text-gray-600 dark:text-gray-400">Uses the same Google connection. Calendar commands are now available.</div>
      )
    },
    {
      id: 'zapier',
      name: 'Zapier',
      icon: <Zap className="w-6 h-6 text-white" />,
      color: 'from-yellow-400 to-orange-500',
      status: zapierSaving ? 'saving' : zapierSaved ? 'connected' : 'disconnected',
      action: (
        <div className="flex flex-col gap-2 w-full">
          <input type="url" className="w-full rounded border px-2 py-1 bg-white dark:bg-neutral-900 border-gray-300 dark:border-neutral-700" placeholder="Zapier Webhook URL" value={zapierUrl || ''} onChange={e => { setZapierUrl(e.target.value); setZapierSaved(false); }} />
          <input type="text" className="w-full rounded border px-2 py-1 bg-white dark:bg-neutral-900 border-gray-300 dark:border-neutral-700" placeholder="Zapier Secret (optional)" value={zapierSecret || ''} onChange={e => { setZapierSecret(e.target.value); setZapierSaved(false); }} />
          <button className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 text-sm w-fit" onClick={() => onSaveZapier(zapierUrl, zapierSecret)} type="button" disabled={zapierSaving}>{zapierSaving ? 'Saving...' : 'Save Zapier Settings'}</button>
          <a href="https://platform.zapier.com/docs/triggers/#webhooks" target="_blank" rel="noopener noreferrer" className="text-blue-500 underline text-xs">How to set up a Zapier webhook?</a>
        </div>
      )
    },
    {
      id: 'n8n',
      name: 'n8n',
      icon: <Webhook className="w-6 h-6 text-white" />,
      color: 'from-pink-500 to-purple-700',
      status: n8nUrl ? 'connected' : 'disconnected',
      action: (
        <div className="flex flex-col gap-2 w-full">
          <input type="url" className="w-full rounded border px-2 py-1 bg-white dark:bg-neutral-900 border-gray-300 dark:border-neutral-700" placeholder="n8n Webhook URL" value={n8nUrl || ''} onChange={e => setN8nUrl(e.target.value)} />
          <input type="text" className="w-full rounded border px-2 py-1 bg-white dark:bg-neutral-900 border-gray-300 dark:border-neutral-700" placeholder="n8n Secret (optional)" value={n8nSecret || ''} onChange={e => setN8nSecret(e.target.value)} />
          <button className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 text-sm w-fit" onClick={() => onSaveN8n(n8nUrl, n8nSecret)} type="button">Save n8n Settings</button>
          <a href="https://docs.n8n.io/integrations/builtin/webhook/" target="_blank" rel="noopener noreferrer" className="text-blue-500 underline text-xs">How to set up an n8n webhook?</a>
        </div>
      )
    }
  ];
  // Map provider icon string to Lucide icon
  const iconMap = { Bot, Zap, Sparkles };
  // Only show OpenAI, Anthropic, and Gemini in the AI Providers section
  const allowedAIProviders = ['openai', 'anthropic', 'gemini'];
  const unifiedItems = [
    { section: 'AI Providers' },
    ...providers.filter(p => allowedAIProviders.includes(p.id)).map(p => ({
      id: p.id,
      name: p.name,
      icon: React.createElement(iconMap[p.icon as keyof typeof iconMap] || Bot, { className: 'w-6 h-6 text-white' }),
      color: p.color,
      status: keyStatus[p.id] || 'disconnected',
      action: (
        <div className="flex flex-col gap-2 w-full">
          <input
            type="password"
            className={`w-full rounded border px-2 py-1 bg-white dark:bg-neutral-900 border-gray-300 dark:border-neutral-700 ${keyError[p.id] ? 'border-red-500' : ''}`}
            placeholder="API Key"
            value={tempKeys[p.id] || ''}
            onChange={e => setTempKeys(k => ({ ...k, [p.id]: e.target.value }))}
          />
          {HELP_LINKS[p.id] && (
            <a href={HELP_LINKS[p.id]} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline text-xs">How to get this?</a>
          )}
          {keyError[p.id] && <div className="text-red-500 text-xs">{keyError[p.id]}</div>}
          <div className="flex space-x-2 mt-1">
            <button
              className="flex-1 bg-neutral-800 text-white px-4 py-2 rounded-lg hover:bg-neutral-900 transition-colors text-sm"
              onClick={() => handleSaveKey(p.id)}
              type="button"
            >
              Save
            </button>
            <button
              className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors text-sm"
              onClick={() => handleDeleteKey(p.id)}
              type="button"
            >
              Delete
            </button>
          </div>
        </div>
      )
    })),
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40" onClick={handleOverlayClick}>
      <div className="bg-white dark:bg-neutral-900 rounded-2xl p-0 w-full max-w-2xl shadow-2xl relative flex flex-col h-[80vh]">
        <button onClick={onClose} className="absolute top-6 right-8 text-2xl text-gray-400 hover:text-gray-700 dark:hover:text-white z-20">✕</button>
        <h2 className="text-2xl font-bold px-10 pt-8 pb-4 border-b border-gray-200 dark:border-neutral-800">Settings</h2>
        <div className="flex-1 overflow-y-auto px-6 py-8">
          <div className="space-y-4">
            {unifiedItems.map((item, idx) =>
              'section' in item ? (
                <div key={item.section} className="pt-4 pb-2 text-xs uppercase tracking-widest text-gray-400 dark:text-gray-500 font-semibold">{item.section}</div>
              ) : (
                <div key={item.id} className="flex items-center gap-4 bg-white/80 dark:bg-neutral-900 dark:border-neutral-700 border border-gray-200 rounded-xl px-5 py-4 shadow-sm hover:shadow-lg transition-all duration-300">
                  <div className={`p-3 rounded-lg bg-gradient-to-br ${item.color} flex items-center justify-center`}>
                    {item.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900 dark:text-white truncate">{item.name}</span>
                      <span className={`text-xs capitalize ${item.status === 'connected' ? 'text-green-600' : 'text-gray-400'}`}>{item.status}</span>
                    </div>
                    <div className="mt-2">{item.action}</div>
                  </div>
                </div>
              )
            )}
            {webhookError && (
              <div className="text-red-500 text-sm mt-2">{webhookError}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}; 