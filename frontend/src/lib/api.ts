import { API_ENDPOINTS } from './config';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code: string;
    details?: any;
  };
  metadata?: {
    timestamp: string;
    requestId: string;
  };
}

export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function apiRequest<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  const data: ApiResponse<T> = await response.json();

  if (!data.success) {
    throw new ApiError(
      data.error?.message || 'Unknown error',
      data.error?.code || 'UNKNOWN_ERROR',
      response.status,
      data.error?.details
    );
  }

  return data.data as T;
}

// Health API
export const healthApi = {
  check: () => apiRequest(API_ENDPOINTS.health),
};

// Authentication API
export const authApi = {
  getGoogleDriveAuthUrl: () =>
    apiRequest<{ authUrl: string; instructions: string[] }>(
      API_ENDPOINTS.auth.googleDrive
    ),
  
  exchangeCode: (code: string) =>
    apiRequest(API_ENDPOINTS.auth.callback, {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),
  
  getStatus: () => apiRequest(API_ENDPOINTS.auth.status),
};

// Documents API
export const documentsApi = {
  ingest: (documentId: string, content: string, mimeType: string = 'text/plain') =>
    apiRequest(API_ENDPOINTS.documents.ingest, {
      method: 'POST',
      body: JSON.stringify({ documentId, content, mimeType }),
    }),
  
  list: () => apiRequest(API_ENDPOINTS.documents.list),
  
  getStats: () => apiRequest<{
    documents: number;
    vectors: number;
    collections: number;
    lastUpdated: string;
  }>(API_ENDPOINTS.documents.list + '/stats'),
  
  reset: () => apiRequest<{
    status: string;
    message: string;
    deletedDocuments: number;
    deletedVectors: number;
    resetTime: string;
  }>(API_ENDPOINTS.documents.list + '/reset', {
    method: 'POST',
  }),
};

// Chat API
export const chatApi = {
  query: (query: string, maxResults: number = 5) =>
    apiRequest<{
      query: string;
      answer: string;
      sources: Array<{
        documentId: string;
        chunkId: string;
        content: string;
        score: number;
      }>;
      confidence: string;
      processingTime: { total: number; unit: string };
    }>(API_ENDPOINTS.chat.query, {
      method: 'POST',
      body: JSON.stringify({ query, maxResults }),
    }),
};

// Sync API
export const syncApi = {
  googleDrive: (options: {
    refreshToken: string;
    accessToken?: string;
    folderId?: string;
    maxFiles?: number;
    mimeTypes?: string[];
  }) =>
    apiRequest(API_ENDPOINTS.sync.googleDrive, {
      method: 'POST',
      body: JSON.stringify(options),
    }),
  
  getStatus: () => apiRequest(API_ENDPOINTS.sync.status),
  
  syncFolder: (folderId: string, options: {
    refreshToken: string;
    accessToken?: string;
    maxFiles?: number;
  }) =>
    apiRequest(API_ENDPOINTS.sync.folder(folderId), {
      method: 'POST',
      body: JSON.stringify(options),
    }),
};
