import { Document, DocumentChunk, EmbeddedChunk, SearchQuery, SearchResult } from '../../types';

// MCP Tool Input/Output Types
export interface GoogleDriveListFilesInput {
  folderId?: string;
  mimeTypes?: string[];
  maxResults?: number;
}

export interface GoogleDriveListFilesOutput {
  files: Array<{
    id: string;
    name: string;
    mimeType: string;
    size: number;
    createdTime: string;
    modifiedTime: string;
    webViewLink: string;
  }>;
  nextPageToken?: string;
}

export interface GoogleDriveDownloadFileInput {
  fileId: string;
  mimeType?: string;
}

export interface GoogleDriveDownloadFileOutput {
  fileId: string;
  fileName: string;
  mimeType: string;
  size: number;
  content: Buffer;
  metadata: {
    createdTime: string;
    modifiedTime: string;
    webViewLink: string;
  };
}

export interface DocumentChunkAndEmbedInput {
  documentId: string;
  content: string;
  mimeType: string;
  chunkSize?: number;
  chunkOverlap?: number;
}

export interface DocumentChunkAndEmbedOutput {
  documentId: string;
  chunks: EmbeddedChunk[];
  totalChunks: number;
  embeddingModel: string;
  dimensions: number;
}

export interface VectorSimilaritySearchInput {
  query: string;
  limit?: number;
  threshold?: number;
  filters?: Record<string, any>;
}

export interface VectorSimilaritySearchOutput {
  results: SearchResult[];
  totalResults: number;
  processingTimeMs: number;
}

export interface DocumentQAQueryInput {
  query: string;
  documentIds?: string[];
  maxResults?: number;
  temperature?: number;
}

export interface DocumentQAQueryOutput {
  answer: string;
  sources: Array<{
    documentId: string;
    documentName: string;
    content: string;
    score: number;
  }>;
  metadata: {
    model: string;
    tokensUsed: number;
    processingTimeMs: number;
  };
}

// MCP Resource Types
export interface GoogleDriveAuthResource {
  authUrl: string;
  tokenInfo?: {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
  };
}

export interface DocumentResource {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, any>;
}

export interface VectorCollectionResource {
  name: string;
  dimensions: number;
  distance: string;
  vectorCount: number;
  indexingStatus: 'indexing' | 'ready' | 'failed';
}

// MCP Error Types
export class MCPError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = 'MCPError';
  }
}

// Circuit Breaker Types
export interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number;
  monitoringWindow: number;
}

export interface CircuitBreakerState {
  status: 'closed' | 'open' | 'half-open';
  failures: number;
  lastFailure: number | null;
  nextAttempt: number | null;
}
