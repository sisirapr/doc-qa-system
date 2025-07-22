'use client';

import { useState, useEffect } from 'react';
import { 
  MessageSquare, 
  Upload, 
  Database, 
  Activity, 
  FileText, 
  Search,
  Cloud,
  CheckCircle,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { healthApi, chatApi, documentsApi } from '@/lib/api';

interface DocumentStats {
  documents: number;
  vectors: number;
  collections: number;
  lastUpdated: string;
}
import GoogleDriveSync from '@/components/GoogleDriveSync';

interface SystemHealth {
  status: string;
  services: {
    api: string;
    ai: {
      status: string;
      details: {
        languageModel: boolean;
        embeddingModel: boolean;
        provider: string;
      };
    };
    database: {
      status: string;
      type: string;
    };
  };
  uptime: number;
  memory: {
    used: number;
    total: number;
    unit: string;
  };
}

export default function HomePage() {
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [answer, setAnswer] = useState('');
  const [sources, setSources] = useState<any[]>([]);
  const [isQuerying, setIsQuerying] = useState(false);
  const [documentContent, setDocumentContent] = useState('');
  const [documentId, setDocumentId] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [stats, setStats] = useState<DocumentStats>({
    documents: 0,
    vectors: 0,
    collections: 0,
    lastUpdated: ''
  });
  const [queryCount, setQueryCount] = useState(0);
  const [queryError, setQueryError] = useState<string>('');
  const [isResetting, setIsResetting] = useState(false);
  const [resetError, setResetError] = useState<string>('');

  useEffect(() => {
    checkSystemHealth();
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const statsData = await documentsApi.getStats();
      setStats(statsData);
    } catch (error) {
      console.error('Failed to fetch statistics:', error);
    }
  };

  const refreshStats = () => {
    fetchStats();
  };

  const checkSystemHealth = async () => {
    try {
      setHealthLoading(true);
      const health = await healthApi.check();
      setSystemHealth(health as SystemHealth);
    } catch (error) {
      console.error('Failed to check system health:', error);
    } finally {
      setHealthLoading(false);
    }
  };

  const handleQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    try {
      setIsQuerying(true);
      setQueryError(''); // Clear previous errors
      const result = await chatApi.query(query);
      setAnswer(result.answer);
      setSources(result.sources || []);
      // Increment query count
      setQueryCount(prev => prev + 1);
    } catch (error: any) {
      console.error('Query failed:', error);
      setQueryError(error.message || 'Failed to process your question. Please try again.');
      setAnswer('');
      setSources([]);
    } finally {
      setIsQuerying(false);
    }
  };

  const handleDocumentUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!documentContent.trim() || !documentId.trim()) return;

    try {
      setIsUploading(true);
      await documentsApi.ingest(documentId, documentContent);
      setDocumentContent('');
      setDocumentId('');
      alert('Document uploaded successfully!');
    } catch (error) {
      console.error('Document upload failed:', error);
      alert('Failed to upload document. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleResetKnowledgeBase = async () => {
    if (!confirm('Are you sure you want to reset the entire knowledge base? This will delete all documents and vectors permanently.')) {
      return;
    }

    try {
      setIsResetting(true);
      setResetError('');
      const result = await documentsApi.reset();
      
      // Refresh statistics after reset
      await fetchStats();
      
      // Reset query count
      setQueryCount(0);
      
      // Clear any existing answers
      setAnswer('');
      setSources([]);
      
      alert(`Knowledge base reset successfully!\n\nDeleted:\n- ${result.deletedDocuments} documents\n- ${result.deletedVectors} vectors`);
      
    } catch (error: any) {
      console.error('Reset failed:', error);
      setResetError(error.message || 'Failed to reset knowledge base. Please try again.');
    } finally {
      setIsResetting(false);
    }
  };


  return (
    <div className="space-y-8">
      {/* System Status */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center">
            <Activity className="w-5 h-5 mr-2" />
            System Status
          </h2>
          <button
            onClick={checkSystemHealth}
            disabled={healthLoading}
            className="text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
          >
            {healthLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Refresh'}
          </button>
        </div>
        
        {systemHealth ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <div>
                <p className="text-sm font-medium">API Server</p>
                <p className="text-xs text-gray-500">{systemHealth.services.api}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <div>
                <p className="text-sm font-medium">AI Services</p>
                <p className="text-xs text-gray-500">{systemHealth.services.ai.details.provider}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <div>
                <p className="text-sm font-medium">Database</p>
                <p className="text-xs text-gray-500">{systemHealth.services.database.type}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <span className="text-sm text-gray-500">Unable to connect to backend</span>
          </div>
        )}
      </div>

      {/* Main Features Grid */}
      <div className="grid grid-cols-1 gap-8">
        {/* Document Q&A */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <MessageSquare className="w-5 h-5 mr-2" />
            Ask Questions
          </h2>
          
          <form onSubmit={handleQuery} className="space-y-4">
            <div>
              <textarea
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  if (queryError) setQueryError(''); // Clear error when user starts typing
                }}
                placeholder="Ask a question about your documents..."
                className="w-full p-3 bg-white text-gray-800 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-500"
                rows={3}
              />
            </div>
            <button
              type="submit"
              disabled={isQuerying || !query.trim()}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {isQuerying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Processing...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4 mr-2" />
                  Ask Question
                </>
              )}
            </button>
          </form>

          {queryError && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-center">
              <AlertCircle className="w-4 h-4 text-red-500 mr-2" />
              <span className="text-red-700 text-sm">{queryError}</span>
            </div>
          )}

          {answer && (
            <div className="mt-6 p-4 bg-blue-50 rounded-md">
              <h3 className="font-medium text-blue-900 mb-2">Answer:</h3>
              <p className="text-blue-800">{answer}</p>
              
              {sources.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-medium text-blue-900 mb-2">Sources:</h4>
                  <div className="space-y-2">
                    {sources.map((source, index) => (
                      <div key={index} className="text-xs bg-white p-2 rounded border">
                        <p className="font-medium">Score: {source.score.toFixed(3)}</p>
                        <p className="text-gray-600 mt-1">{source.content.substring(0, 200)}...</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Document Upload - COMMENTED OUT (Only using Google Drive sync) */}
        {/*
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Upload className="w-5 h-5 mr-2" />
            Upload Document
          </h2>
          
          <form onSubmit={handleDocumentUpload} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Document ID
              </label>
              <input
                type="text"
                value={documentId}
                onChange={(e) => setDocumentId(e.target.value)}
                placeholder="Enter a unique document ID..."
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Document Content
              </label>
              <textarea
                value={documentContent}
                onChange={(e) => setDocumentContent(e.target.value)}
                placeholder="Paste your document content here..."
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
                rows={6}
              />
            </div>
            <button
              type="submit"
              disabled={isUploading || !documentContent.trim() || !documentId.trim()}
              className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Uploading...
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4 mr-2" />
                  Upload Document
                </>
              )}
            </button>
          </form>
        </div>
        */}
      </div>

      {/* Google Drive Integration */}
      <GoogleDriveSync onSyncComplete={refreshStats} />

      {/* Reset Knowledge Base */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Database className="w-5 h-5 mr-2" />
          Knowledge Base Management
        </h2>
        
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
          <div className="flex items-center mb-2">
            <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
            <h3 className="font-medium text-red-900">Danger Zone</h3>
          </div>
          <p className="text-sm text-red-700 mb-4">
            Resetting the knowledge base will permanently delete all documents, vectors, and embeddings. 
            This action cannot be undone.
          </p>
          
          {resetError && (
            <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded-md flex items-center">
              <AlertCircle className="w-4 h-4 text-red-600 mr-2" />
              <span className="text-red-800 text-sm">{resetError}</span>
            </div>
          )}
          
          <button
            onClick={handleResetKnowledgeBase}
            disabled={isResetting}
            className="bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {isResetting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Resetting...
              </>
            ) : (
              <>
                <Database className="w-4 h-4 mr-2" />
                Reset Knowledge Base
              </>
            )}
          </button>
        </div>
        
        <div className="text-sm text-gray-600">
          <p className="mb-2"><strong>What this does:</strong></p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>Deletes all stored documents and their content</li>
            <li>Removes all vector embeddings from the database</li>
            <li>Clears the document collection completely</li>
            <li>Resets statistics to zero</li>
            <li>Recreates a fresh, empty collection</li>
          </ul>
          <p className="mt-3 text-xs text-gray-500">
            After reset, you can re-sync documents from Google Drive or upload new content.
          </p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <FileText className="w-8 h-8 text-blue-500" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Documents</p>
              <p className="text-lg font-semibold text-gray-900">{stats.documents}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <MessageSquare className="w-8 h-8 text-green-500" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Queries</p>
              <p className="text-lg font-semibold text-gray-900">{queryCount}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <Database className="w-8 h-8 text-purple-500" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Vectors</p>
              <p className="text-lg font-semibold text-gray-900">{stats.vectors}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <Activity className="w-8 h-8 text-red-500" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Uptime</p>
              <p className="text-lg font-semibold text-gray-900">
                {systemHealth ? `${Math.round(systemHealth.uptime)}s` : '--'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
