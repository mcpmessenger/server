import React, { useState } from 'react';
import { Bot, Globe } from 'lucide-react';

interface GoogleConnectProps {
  onInsert: (content: string) => void;
}

export const GoogleConnect: React.FC<GoogleConnectProps> = ({ onInsert }) => {
  const [connected, setConnected] = useState(false);
  const [driveFiles, setDriveFiles] = useState<any[]>([]);
  const [gmailMessages, setGmailMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const handleLogin = () => {
    window.open('http://localhost:3001/auth/google', '_blank', 'width=500,height=600');
    setTimeout(() => setConnected(true), 2000); // naive: assume success after 2s
  };

  const fetchDriveFiles = async () => {
    setLoading(true);
    const res = await fetch('http://localhost:3001/api/google/drive-files', { credentials: 'include' });
    const data = await res.json();
    const repoLines = data.slice(0, limit).map(r => `• ${r.full_name}`).join('\n');
    setDriveFiles(data.files || []);
    setLoading(false);
  };

  const fetchGmailMessages = async () => {
    setLoading(true);
    const res = await fetch('http://localhost:3001/api/google/gmail-messages', { credentials: 'include' });
    const data = await res.json();
    setGmailMessages(data.messages || []);
    setLoading(false);
  };

  return (
    <div className="bg-white/70 dark:bg-neutral-900 dark:border-neutral-700 backdrop-blur-sm rounded-xl p-6 border border-gray-200 hover:shadow-lg transition-all duration-300">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="p-3 rounded-lg bg-gradient-to-br from-green-400 to-blue-500">
            <Globe className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Google</h3>
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-gray-400'}`} />
              <span className={`text-sm capitalize ${connected ? 'text-green-500' : 'text-gray-400'}`}>{connected ? 'connected' : 'disconnected'}</span>
            </div>
          </div>
        </div>
      </div>
      <div className="flex items-center space-x-4 mb-4">
        <button
          onClick={handleLogin}
          className="bg-neutral-800 text-white px-4 py-2 rounded-lg hover:bg-neutral-900"
          disabled={connected}
        >
          {connected ? 'Connected to Google' : 'Login with Google'}
        </button>
      </div>
      {connected && (
        <div className="space-y-2">
          <button onClick={fetchDriveFiles} className="bg-neutral-700 text-white px-3 py-1 rounded hover:bg-neutral-800">Browse Drive Files</button>
          <button onClick={fetchGmailMessages} className="bg-neutral-700 text-white px-3 py-1 rounded hover:bg-neutral-800 ml-2">Browse Gmail Messages</button>
          {loading && <div className="text-gray-500">Loading...</div>}
          <div className="mt-2">
            {driveFiles.length > 0 && <>
              <div className="font-bold mb-1">Drive Files:</div>
              <ul className="mb-2">
                {driveFiles.map(f => (
                  <li key={f.id} className="flex items-center justify-between mb-1">
                    <span>{f.name} <span className="text-xs text-gray-400">({f.mimeType})</span></span>
                    <button onClick={() => onInsert(f.name)} className="text-blue-600 hover:underline ml-2">Insert</button>
                  </li>
                ))}
              </ul>
            </>}
            {gmailMessages.length > 0 && <>
              <div className="font-bold mb-1">Gmail Messages:</div>
              <ul>
                {gmailMessages.map(m => (
                  <li key={m.id} className="flex items-center justify-between mb-1">
                    <span>Message ID: {m.id}</span>
                    <button onClick={() => onInsert(m.id)} className="text-blue-600 hover:underline ml-2">Insert</button>
                  </li>
                ))}
              </ul>
            </>}
          </div>
        </div>
      )}
    </div>
  );
}; 