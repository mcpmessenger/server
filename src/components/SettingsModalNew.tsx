import React from 'react';
import { Provider } from '../types';
import { Bot, Zap, Sparkles, Globe, Heart } from 'lucide-react';

interface SettingsModalNewProps {
  open: boolean;
  onClose: () => void;
  providers: Provider[];
  onSetApiKey: (id: string, key: string) => void;
  onSetStatus: (id: string, status: Provider['status']) => void;
}

const iconMap: Record<string, React.ElementType> = { Bot, Zap, Sparkles, Globe, Heart };

const Indicator: React.FC<{ status: string }> = ({ status }) => (
  <span
    className={`inline-flex items-center justify-center w-2 h-2 rounded-full ${
      status === 'connected' ? 'bg-green-500' : status === 'error' ? 'bg-red-500' : status === 'pending' ? 'bg-yellow-500' : 'bg-gray-400'
    }`}
  />
);

export const SettingsModalNew: React.FC<SettingsModalNewProps> = ({ open, onClose, providers, onSetApiKey, onSetStatus }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={e => e.target === e.currentTarget && onClose() }>
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-y-auto">
        <header className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-neutral-800 sticky top-0 bg-inherit z-10">
          <h2 className="text-xl font-semibold">Settings</h2>
          <button onClick={onClose} className="text-2xl text-gray-400 hover:text-gray-600">✕</button>
        </header>
        <div className="p-6 space-y-8">
          <section>
            <h3 className="text-sm font-semibold text-gray-500 uppercase mb-4">Providers</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {providers.filter(p => ['openai','anthropic','gemini','github'].includes(p.id)).map(p => {
                const Icon = iconMap[p.icon as string] || Globe;
                return (
                  <div key={p.id} className="border border-gray-200 dark:border-neutral-700 rounded-xl p-4 flex flex-col gap-3 bg-white/70 dark:bg-neutral-800">
                    <div className="flex items-center gap-3">
                      <span className={`p-2 rounded-lg bg-gradient-to-br ${p.color}`}> <Icon className="w-5 h-5 text-white" /> </span>
                      <span className="font-medium flex-1 truncate">{p.name}</span>
                      <Indicator status={p.status} />
                    </div>
                    <input
                      type="password"
                      className="w-full px-3 py-2 rounded border border-gray-300 dark:border-neutral-600 bg-transparent text-sm"
                      placeholder="API key"
                      value={p.apiKey || ''}
                      onChange={e => onSetApiKey(p.id, e.target.value)}
                    />
                    <button
                      onClick={async () => {
                        const resp = await fetch('http://localhost:3001/api/validate-key', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ provider: p.id, apiKey: p.apiKey })
                        }).then(r=>r.json());
                        onSetStatus(p.id, resp.valid ? 'connected' : 'error');
                      }}
                      className="bg-blue-600 text-white text-xs px-3 py-1 rounded hover:bg-blue-700"
                    >Test</button>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}; 