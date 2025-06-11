import React from 'react';

interface Command {
  id: string;
  name: string;
  description: string;
  example: string;
}

interface CommandListProps {
  open: boolean;
  commands: Command[];
  onInsert: (example: string) => void;
  onClose: () => void;
}

export const CommandList: React.FC<CommandListProps> = ({ open, commands, onInsert, onClose }) => {
  if (!open) return null;
  // Close if clicking the overlay (but not the modal box)
  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40" onClick={handleOverlayClick}>
      <div className="bg-white dark:bg-neutral-900 rounded-xl p-8 w-full max-w-2xl shadow-lg relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 dark:hover:text-white">✕</button>
        <h2 className="text-xl font-bold mb-4">MCP Command List</h2>
        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          {commands.map(cmd => (
            <div key={cmd.id} className="border-b border-gray-200 dark:border-neutral-700 pb-2 mb-2">
              <div className="font-semibold">{cmd.name}</div>
              <div className="text-sm text-gray-600 dark:text-gray-300 mb-1">{cmd.description}</div>
              <div className="text-xs text-gray-500 mb-1">Example: <span className="font-mono">{cmd.example}</span></div>
              <button
                onClick={() => onInsert(cmd.example)}
                className="bg-neutral-800 text-white px-3 py-1 rounded hover:bg-neutral-900 text-xs"
              >
                Insert Example
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}; 