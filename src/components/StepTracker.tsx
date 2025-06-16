import React, { useState } from 'react';

export interface StepInfo {
  provider: string;
  command: string;
  status: 'queued' | 'running' | 'success' | 'error';
  output?: string;
  error?: string;
}

interface StepTrackerProps {
  steps: StepInfo[];
  className?: string;
}

const statusColor = {
  queued: 'text-gray-500',
  running: 'text-blue-500',
  success: 'text-green-600',
  error: 'text-red-600',
};

export const StepTracker: React.FC<StepTrackerProps> = ({ steps, className }) => {
  const [expanded, setExpanded] = useState<number | null>(null);

  if (!steps?.length) return null;

  return (
    <div className={`w-full bg-white/80 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-xl p-4 ${className || ''}`}>
      <h3 className="text-sm font-semibold mb-3">Workflow Progress</h3>
      <ol className="space-y-2">
        {steps.map((s, idx) => (
          <li key={idx} className="flex items-start">
            {/* Indicator */}
            <span className={`mr-2 text-lg ${statusColor[s.status]}`}>{
              s.status === 'success' ? '✔' : s.status === 'error' ? '✖' : s.status === 'running' ? '⏳' : '•'
            }</span>
            <div className="flex-1">
              <button
                type="button"
                className="text-left w-full focus:outline-none"
                onClick={() => setExpanded(expanded === idx ? null : idx)}
              >
                <span className="font-mono text-xs bg-gray-100 dark:bg-neutral-800 px-1 py-0.5 rounded mr-2">
                  {idx + 1}
                </span>
                <span className="font-semibold">{s.command}</span>
                <span className="ml-1 text-gray-500">({s.provider})</span>
              </button>
              {expanded === idx && (
                <div className="mt-1 text-xs whitespace-pre-wrap bg-gray-50 dark:bg-neutral-800 p-2 rounded">
                  {s.status === 'error' ? s.error || 'Error' : s.output || 'No output'}
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
};

export default StepTracker; 