'use client';

import { useState } from 'react';
import { Cloud, Download, CheckCircle, AlertCircle, Loader2, FileText } from 'lucide-react';
import { authApi, syncApi } from '@/lib/api';

interface GoogleDriveAuthResponse {
  message: string;
  refreshToken: string;
  expiresAt: number;
}

interface SyncResult {
  status: string;
  totalFiles: number;
  processedFiles: number;
  skippedFiles: number;
  results: Array<{
    fileId: string;
    fileName: string;
    status: string;
    chunks: number;
    size: number;
    mimeType: string;
    vectors?: number;
    processingTime?: number;
  }>;
  errors: Array<{
    fileId: string;
    fileName: string;
    error: string;
  }>;
  summary: {
    successRate: string;
    totalChunks: number;
    totalSize: number;
    totalVectors?: number;
    processingTime?: number;
  };
}

interface GoogleDriveSyncProps {
  onSyncComplete?: () => void;
}

export default function GoogleDriveSync({ onSyncComplete }: GoogleDriveSyncProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [refreshToken, setRefreshToken] = useState<string>('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string>('');
  const [authCode, setAuthCode] = useState<string>('');
  const [showAuthCodeInput, setShowAuthCodeInput] = useState(false);

  const handleConnect = async () => {
    try {
      setIsConnecting(true);
      setError('');
      
      const result = await authApi.getGoogleDriveAuthUrl();
      
      // Open the auth URL in a new window
      const popup = window.open(result.authUrl, '_blank', 'width=600,height=600');
      
      // Listen for the authentication result
      const handleMessage = (event: MessageEvent) => {
        if (event.data.type === 'GOOGLE_DRIVE_AUTH_SUCCESS') {
      // Authentication successful
      setRefreshToken(event.data.refreshToken);
      setIsAuthenticated(true);
      setIsConnecting(false);
      setError(''); // Clear any previous errors
      
      // Automatically start syncing documents
      handleSync();
          
          // Clean up
          window.removeEventListener('message', handleMessage);
          if (popup) {
            popup.close();
          }
        }
      };
      
      window.addEventListener('message', handleMessage);
      
      // Handle popup being closed manually
      const checkClosed = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkClosed);
          window.removeEventListener('message', handleMessage);
          setIsConnecting(false);
        }
      }, 1000);
      
    } catch (err) {
      setError('Failed to get Google Drive authorization URL');
      console.error('Auth error:', err);
      setIsConnecting(false);
    }
  };

  const handleAuthCodeSubmit = async () => {
    if (!authCode.trim()) {
      setError('Please enter the authorization code');
      return;
    }

    try {
      setIsConnecting(true);
      setError('');

      const result = await authApi.exchangeCode(authCode) as GoogleDriveAuthResponse;
      
      setRefreshToken(result.refreshToken);
      setIsAuthenticated(true);
      setShowAuthCodeInput(false);
      setAuthCode('');
      setError(''); // Clear any previous errors
      
    } catch (err) {
      setError('Failed to exchange authorization code. Please try again.');
      console.error('Token exchange error:', err);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleSync = async () => {
    if (!refreshToken) {
      setError('Please connect to Google Drive first');
      return;
    }

    try {
      setIsSyncing(true);
      setError('');
      setSyncResult(null);

      const result = await syncApi.googleDrive({
        refreshToken,
        maxFiles: 10, // Limit for demo
        mimeTypes: ['text/plain', 'application/vnd.google-apps.document']
      }) as { data: SyncResult };

      setSyncResult(result.data);
      
      // Call the callback to refresh statistics
      if (onSyncComplete) {
        onSyncComplete();
      }
      
    } catch (err: any) {
      setError(err.message || 'Failed to sync Google Drive documents');
      console.error('Sync error:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDisconnect = () => {
    setIsAuthenticated(false);
    setRefreshToken('');
    setSyncResult(null);
    setError('');
    setShowAuthCodeInput(false);
    setAuthCode('');
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
        <Cloud className="w-5 h-5 mr-2" />
        Google Drive Integration
      </h2>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-center">
          <AlertCircle className="w-4 h-4 text-red-500 mr-2" />
          <span className="text-red-700 text-sm">{error}</span>
        </div>
      )}

      {!isAuthenticated ? (
        <div className="space-y-4">
          <div>
            <h3 className="font-medium text-gray-900 mb-2">Connect Your Google Drive</h3>
            <p className="text-sm text-gray-600 mb-4">
              Sync documents from your Google Drive to make them searchable and queryable.
            </p>
            
            {!showAuthCodeInput ? (
              <button
                onClick={handleConnect}
                disabled={isConnecting}
                className="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Cloud className="w-4 h-4 mr-2" />
                    Connect Google Drive
                  </>
                )}
              </button>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Authorization Code
                  </label>
                  <p className="text-xs text-gray-500 mb-2">
                    Copy the authorization code from the popup window and paste it here:
                  </p>
                  <input
                    type="text"
                    value={authCode}
                    onChange={(e) => setAuthCode(e.target.value)}
                    placeholder="Paste authorization code here..."
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={handleAuthCodeSubmit}
                    disabled={isConnecting || !authCode.trim()}
                    className="bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 disabled:opacity-50 flex items-center"
                  >
                    {isConnecting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Authenticating...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Complete Authentication
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setShowAuthCodeInput(false);
                      setAuthCode('');
                      setError('');
                    }}
                    className="bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-md">
            <div className="flex items-center">
              <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
              <span className="text-green-700 font-medium">Connected to Google Drive</span>
            </div>
            <button
              onClick={handleDisconnect}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Disconnect
            </button>
          </div>

          <div className="flex space-x-4">
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center"
            >
              {isSyncing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Syncing Documents...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Sync Documents
                </>
              )}
            </button>
          </div>

          {syncResult && (
            <div className="mt-6 p-4 bg-gray-50 rounded-md">
              <h4 className="font-medium text-gray-900 mb-3">Sync Results</h4>
              
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{syncResult.totalFiles}</div>
                  <div className="text-sm text-gray-500">Total Files</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{syncResult.processedFiles}</div>
                  <div className="text-sm text-gray-500">Processed</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600">{syncResult.skippedFiles}</div>
                  <div className="text-sm text-gray-500">Skipped</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">{syncResult.summary.totalChunks}</div>
                  <div className="text-sm text-gray-500">Text Chunks</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-indigo-600">{syncResult.summary.totalVectors || syncResult.summary.totalChunks}</div>
                  <div className="text-sm text-gray-500">Vectors Created</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 text-sm">
                <div className="text-center p-3 bg-white rounded border">
                  <div className="font-medium text-gray-900">Success Rate</div>
                  <div className="text-lg font-bold text-green-600">{syncResult.summary.successRate}</div>
                </div>
                <div className="text-center p-3 bg-white rounded border">
                  <div className="font-medium text-gray-900">Total Size</div>
                  <div className="text-lg font-bold text-blue-600">{Math.round((syncResult.summary.totalSize || 0) / 1024)}KB</div>
                </div>
                <div className="text-center p-3 bg-white rounded border">
                  <div className="font-medium text-gray-900">Processing Time</div>
                  <div className="text-lg font-bold text-purple-600">{syncResult.summary.processingTime ? `${Math.round(syncResult.summary.processingTime / 1000)}s` : 'N/A'}</div>
                </div>
              </div>

              {syncResult.results.length > 0 && (
                <div>
                  <h5 className="font-medium text-gray-900 mb-2">Processed Files:</h5>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {syncResult.results.map((file, index) => (
                      <div key={index} className="p-3 bg-white rounded border">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center">
                            <FileText className="w-4 h-4 text-gray-400 mr-2" />
                            <span className="text-sm font-medium">{file.fileName}</span>
                          </div>
                          <div className="text-xs text-gray-500">
                            {Math.round(file.size / 1024)}KB
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-xs">
                          <div className="text-center p-2 bg-purple-50 rounded">
                            <div className="font-medium text-purple-700">{file.chunks}</div>
                            <div className="text-purple-600">Text Chunks</div>
                          </div>
                          <div className="text-center p-2 bg-indigo-50 rounded">
                            <div className="font-medium text-indigo-700">{file.vectors || file.chunks}</div>
                            <div className="text-indigo-600">Vectors</div>
                          </div>
                          <div className="text-center p-2 bg-green-50 rounded">
                            <div className="font-medium text-green-700">{file.processingTime ? `${Math.round(file.processingTime / 1000)}s` : 'N/A'}</div>
                            <div className="text-green-600">Process Time</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {syncResult.errors.length > 0 && (
                <div className="mt-4">
                  <h5 className="font-medium text-red-900 mb-2">Errors:</h5>
                  <div className="space-y-1">
                    {syncResult.errors.map((error, index) => (
                      <div key={index} className="text-sm text-red-600 bg-red-50 p-2 rounded">
                        <span className="font-medium">{error.fileName}:</span> {error.error}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
