import React, { useState } from 'react';
import { Bot, Github } from 'lucide-react';

interface GitHubConnectProps {
  onInsert: (content: string) => void;
}

export const GitHubConnect: React.FC<GitHubConnectProps> = ({ onInsert }) => {
  const [connected, setConnected] = useState(false);
  const [repos, setRepos] = useState<any[]>([]);
  const [files, setFiles] = useState<any[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = () => {
    window.open('http://localhost:3001/auth/github', '_blank', 'width=500,height=600');
    setTimeout(() => setConnected(true), 2000); // naive: assume success after 2s
  };

  const fetchRepos = async () => {
    setLoading(true);
    const res = await fetch('http://localhost:3001/api/github/repos', { credentials: 'include' });
    const data = await res.json();
    setRepos(data.repos || []);
    setLoading(false);
  };

  const fetchFiles = async (owner: string, repo: string) => {
    setLoading(true);
    const res = await fetch(`http://localhost:3001/api/github/files?owner=${owner}&repo=${repo}`, { credentials: 'include' });
    const data = await res.json();
    setFiles(Array.isArray(data.files) ? data.files : [data.files]);
    setLoading(false);
  };

  const handleRepoSelect = (repo: any) => {
    setSelectedRepo(repo.name);
    fetchFiles(repo.owner.login, repo.name);
  };

  const handleFileInsert = async (file: any) => {
    if (file.type === 'file') {
      const res = await fetch(file.download_url);
      const content = await res.text();
      onInsert(content);
    }
  };

  return (
    <div className="bg-white/70 dark:bg-neutral-900 dark:border-neutral-700 backdrop-blur-sm rounded-xl p-6 border border-gray-200 hover:shadow-lg transition-all duration-300">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="p-3 rounded-lg bg-gradient-to-br from-gray-700 to-black">
            <Github className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">GitHub</h3>
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
          {connected ? 'Connected to GitHub' : 'Connect GitHub'}
        </button>
      </div>
      {connected && (
        <div className="space-y-2">
          <button onClick={fetchRepos} className="bg-neutral-700 text-white px-3 py-1 rounded hover:bg-neutral-800">Browse Repos</button>
          {loading && <div className="text-gray-500">Loading...</div>}
          <div className="mt-2">
            {repos.length > 0 && <>
              <div className="font-bold mb-1">Repositories:</div>
              <ul className="mb-2">
                {repos.map(r => (
                  <li key={r.id} className="flex items-center justify-between mb-1">
                    <span>{r.full_name}</span>
                    <button onClick={() => handleRepoSelect(r)} className="text-blue-600 hover:underline ml-2">Files</button>
                  </li>
                ))}
              </ul>
            </>}
            {files.length > 0 && <>
              <div className="font-bold mb-1">Files in {selectedRepo}:</div>
              <ul>
                {files.map(f => (
                  <li key={f.sha || f.path} className="flex items-center justify-between mb-1">
                    <span>{f.name}</span>
                    {f.type === 'file' && (
                      <button onClick={() => handleFileInsert(f)} className="text-blue-600 hover:underline ml-2">Insert</button>
                    )}
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