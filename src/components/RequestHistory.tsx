import React, { useState } from 'react';
import { MCPRequest } from '../types';
import { Clock, CheckCircle, XCircle, Loader2, Trash2, Copy } from 'lucide-react';

interface RequestHistoryProps {
  requests: MCPRequest[];
  onClearHistory: () => void;
}

export const RequestHistory: React.FC<RequestHistoryProps> = ({
  requests,
  onClearHistory
}) => {
  const [expandedRequest, setExpandedRequest] = useState<string | null>(null);

  const getStatusIcon = (status: MCPRequest['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'pending':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const formatDuration = (duration?: number) => {
    if (!duration) return '';
    return duration < 1000 ? `${duration}ms` : `${(duration / 1000).toFixed(1)}s`;
  };

  if (requests.length === 0) {
    return (
      <div className="bg-white/70 backdrop-blur-sm rounded-xl p-6 border border-gray-200">
        <div className="text-center py-8">
          <Clock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No requests yet</h3>
          <p className="text-gray-500">Execute your first command to see the history here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/70 backdrop-blur-sm rounded-xl p-6 border border-gray-200">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Request History</h2>
        <button
          onClick={onClearHistory}
          className="flex items-center space-x-2 text-red-600 hover:text-red-700 text-sm"
        >
          <Trash2 className="w-4 h-4" />
          <span>Clear History</span>
        </button>
      </div>

      <div className="space-y-3">
        {requests.map((request) => (
          <div
            key={request.id}
            className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center space-x-2">
                {getStatusIcon(request.status)}
                <span className="text-sm font-medium text-gray-900">
                  {request.provider} • {request.command}
                </span>
                <span className="text-xs text-gray-500">
                  {request.timestamp.toLocaleTimeString()}
                </span>
              </div>
              <button
                onClick={() => setExpandedRequest(
                  expandedRequest === request.id ? null : request.id
                )}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                {expandedRequest === request.id ? 'Collapse' : 'Expand'}
              </button>
            </div>

            <div className="text-sm text-gray-600 mb-2 font-mono bg-gray-50 p-2 rounded">
              {request.prompt}
            </div>

            {request.status === 'completed' && (
              <div className="flex items-center space-x-4 text-xs text-gray-500">
                {request.tokensUsed && <span>{request.tokensUsed} tokens</span>}
                {request.modelVersion && <span>{request.modelVersion}</span>}
                {request.duration && <span>{formatDuration(request.duration)}</span>}
              </div>
            )}

            {expandedRequest === request.id && request.response && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Response</span>
                  <button
                    onClick={() => copyToClipboard(request.response || '')}
                    className="flex items-center space-x-1 text-xs text-gray-500 hover:text-gray-700"
                  >
                    <Copy className="w-3 h-3" />
                    <span>Copy</span>
                  </button>
                </div>
                <div className="text-sm text-gray-800 bg-gray-50 p-3 rounded border">
                  {request.response}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};