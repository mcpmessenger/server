import React, { useState } from 'react';
import { Provider, Command } from '../types';
// @ts-ignore
import mcp from '../services/mcpServerService.js';
import { useJobPolling } from '../hooks/useJobPolling';
import StepTracker, { StepInfo } from './StepTracker';

interface WorkflowStep {
  provider: string;
  command: string;
  prompt: string;
  apiKey?: string;
}

interface WorkflowBuilderProps {
  providers: Provider[];
  commands: Command[];
  onRunWorkflow: (workflow: WorkflowStep[], onStepResult: (idx: number, status: 'running' | 'success' | 'error', output?: string) => void) => Promise<void>;
  loading: boolean;
  contextHistory: { prompt: string; response: string }[];
}

export const WorkflowBuilder: React.FC<WorkflowBuilderProps> = ({
  providers,
  commands,
  onRunWorkflow,
  loading,
  contextHistory
}) => {
  const [steps, setSteps] = useState<WorkflowStep[]>([
    { provider: '', command: '', prompt: '' }
  ]);
  const [stepResults, setStepResults] = useState<{ status: 'idle' | 'running' | 'success' | 'error'; output?: string }[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [jobId, setJobId] = useState<string>('');

  const { job } = useJobPolling(jobId);

  const handleStepChange = (idx: number, field: keyof WorkflowStep, value: string) => {
    setSteps(prev => prev.map((step, i) => i === idx ? { ...step, [field]: value } : step));
  };

  const addStep = () => {
    setSteps(prev => [...prev, { provider: '', command: '', prompt: '' }]);
  };

  const removeStep = (idx: number) => {
    setSteps(prev => prev.filter((_, i) => i !== idx));
    setStepResults(prev => prev.filter((_, i) => i !== idx));
  };

  const handleRun = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsRunning(true);
    try {
      const resp = await mcp.runWorkflow(steps, contextHistory[contextHistory.length-1]?.response || '');
      setJobId(resp.jobId);
    } catch(err:any){
      alert(err.message || 'Workflow error');
    }
  };

  const trackerSteps: StepInfo[] = (job?.results || []).map((r:any)=>({
    provider: r.provider,
    command: r.command,
    status: r.status || (job.done? 'success':'running'),
    output: r.output,
    error: r.error
  }));

  return (
    <div className="w-full bg-white/80 dark:bg-neutral-900 dark:border-neutral-700 rounded-xl p-6 border border-gray-200 shadow-lg">
      <div className="flex items-center mb-4">
        <h2 className="text-lg font-semibold mr-2">Workflow Builder</h2>
        <button
          type="button"
          aria-label="Help"
          className="text-blue-600 hover:text-blue-800 text-xl ml-2"
          onClick={() => setShowHelp(true)}
        >
          ?
        </button>
      </div>
      {showHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white dark:bg-neutral-900 rounded-xl p-6 max-w-md w-full relative border border-gray-200 dark:border-neutral-700">
            <button
              className="absolute top-2 right-2 text-gray-500 hover:text-gray-800"
              onClick={() => setShowHelp(false)}
              aria-label="Close help"
            >
              ✕
            </button>
            <h3 className="text-lg font-bold mb-2">How to Use the Workflow Builder</h3>
            <ul className="list-disc pl-5 mb-2 text-sm">
              <li>Add steps to your workflow. Each step can use a different provider and command.</li>
              <li>Chain commands together: the output of one step can be used as the input for the next.</li>
              <li>Click "Run Workflow" to execute all steps in order. Progress and results will be shown for each step.</li>
            </ul>
            <div className="mb-2 text-sm">
              <strong>Example:</strong>
              <ul className="list-disc pl-5">
                <li>Step 1: Summarize a document</li>
                <li>Step 2: Translate the summary to Spanish</li>
              </ul>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-300">Tip: You can leave a step's prompt blank to use the previous step's output as input.</div>
          </div>
        </div>
      )}
      <form onSubmit={handleRun} className="space-y-6">
        {steps.map((step, idx) => {
          const availableCommands = commands.filter(cmd => cmd.provider === 'all' || cmd.provider === step.provider);
          return (
            <div key={idx} className="flex flex-col md:flex-row md:items-end md:space-x-4 space-y-2 md:space-y-0 border-b border-gray-200 dark:border-neutral-700 pb-4 mb-4">
              <select
                value={step.provider}
                onChange={e => handleStepChange(idx, 'provider', e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-neutral-700 rounded-lg min-w-32 bg-white dark:bg-neutral-800"
                required
              >
                <option value="">Provider</option>
                {providers.filter(p => p.status === 'connected').map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <select
                value={step.command}
                onChange={e => handleStepChange(idx, 'command', e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-neutral-700 rounded-lg min-w-32 bg-white dark:bg-neutral-800"
                required
              >
                <option value="">Command</option>
                {availableCommands.map(cmd => (
                  <option key={cmd.id} value={cmd.id}>{cmd.name}</option>
                ))}
              </select>
              <textarea
                value={step.prompt}
                onChange={e => handleStepChange(idx, 'prompt', e.target.value)}
                placeholder="Prompt (or leave blank to use previous step's output)"
                rows={2}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800"
              />
              <button type="button" onClick={() => removeStep(idx)} className="ml-2 text-red-600 hover:text-red-800">Remove</button>
              {/* Step progress/result */}
              {stepResults[idx] && (
                <div className="ml-4">
                  {stepResults[idx].status === 'running' && <span className="text-blue-500">Running...</span>}
                  {stepResults[idx].status === 'success' && <span className="text-green-600">✔ {stepResults[idx].output}</span>}
                  {stepResults[idx].status === 'error' && <span className="text-red-600">✖ {stepResults[idx].output}</span>}
                </div>
              )}
            </div>
          );
        })}
        <div className="flex space-x-2">
          <button type="button" onClick={addStep} className="bg-neutral-800 text-white px-4 py-2 rounded-lg hover:bg-neutral-900">Add Step</button>
          <button type="submit" disabled={loading || isRunning} className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed">
            {loading || isRunning ? 'Running...' : 'Run Workflow'}
          </button>
        </div>
      </form>
      {trackerSteps.length > 0 && <StepTracker steps={trackerSteps} className="mt-6" />}

      <div className="mt-8">
        <h3 className="text-md font-semibold mb-2">Context / History</h3>
        <div className="max-h-48 overflow-y-auto space-y-2">
          {contextHistory.length === 0 && <div className="text-gray-500">No history yet.</div>}
          {contextHistory.map((item, i) => (
            <div key={i} className="p-2 rounded bg-gray-100 dark:bg-neutral-800 text-xs">
              <div className="font-bold">Prompt:</div>
              <div className="mb-1">{item.prompt}</div>
              <div className="font-bold">Response:</div>
              <div>{item.response}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}; 