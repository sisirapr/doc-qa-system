export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

export const API_ENDPOINTS = {
  health: `${API_BASE_URL}/api/health`,
  auth: {
    googleDrive: `${API_BASE_URL}/api/auth/google-drive`,
    callback: `${API_BASE_URL}/api/auth/google-drive/callback`,
    status: `${API_BASE_URL}/api/auth/status`,
  },
  documents: {
    ingest: `${API_BASE_URL}/api/documents/ingest`,
    list: `${API_BASE_URL}/api/documents`,
  },
  chat: {
    query: `${API_BASE_URL}/api/chat/query`,
  },
  sync: {
    googleDrive: `${API_BASE_URL}/api/sync/google-drive`,
    status: `${API_BASE_URL}/api/sync/status`,
    folder: (folderId: string) => `${API_BASE_URL}/api/sync/google-drive/folder/${folderId}`,
  },
} as const;
