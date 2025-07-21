/**
 * MCP Error class
 */
export class MCPError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number,
    public details?: any
  ) {
    super(message);
    this.name = 'MCPError';
  }
}

/**
 * Document chunk and embed input
 */
export interface DocumentChunkAndEmbedInput {
  documentId: string;
  content: string;
  chunkSize?: number;
  chunkOverlap?: number;
  mimeType?: string;
}

/**
 * Embedded chunk metadata
 */
export interface EmbeddedChunkMetadata {
  chunkIndex: number;
  totalChunks: number;
}

/**
 * Embedded chunk
 */
export interface EmbeddedChunk {
  id: string;
  documentId: string;
  content: string;
  index: number;
  startOffset: number;
  endOffset: number;
  vector: number[];
  metadata: EmbeddedChunkMetadata;
}

/**
 * Document chunk and embed output
 */
export interface DocumentChunkAndEmbedOutput {
  documentId: string;
  chunks: EmbeddedChunk[];
  processingTimeMs: number;
}

/**
 * Vector similarity search input
 */
export interface VectorSimilaritySearchInput {
  query: string;
  limit?: number;
  threshold?: number;
  filters?: Record<string, any>;
}

/**
 * Vector similarity search output
 */
export interface VectorSimilaritySearchOutput {
  results: Array<{
    id: string;
    score: number;
    content: string;
    metadata: Record<string, any>;
  }>;
  totalResults: number;
  processingTimeMs: number;
}

/**
 * Google Drive list files input
 */
export interface GoogleDriveListFilesInput {
  folderId?: string;
  maxResults?: number;
  mimeTypes?: string[];
}

/**
 * Google Drive list files output
 */
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

/**
 * Google Drive download file input
 */
export interface GoogleDriveDownloadFileInput {
  fileId: string;
  mimeType?: string;
}

/**
 * Google Drive download file output
 */
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

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number;
  monitoringWindow: number;
}

/**
 * Circuit breaker state
 */
export interface CircuitBreakerState {
  status: 'closed' | 'open' | 'half-open';
  failures: number;
  lastFailure: number | null;
  nextAttempt: number | null;
}

/**
 * Document Q&A query input
 */
export interface DocumentQAQueryInput {
  query: string;
  maxResults?: number;
  filters?: Record<string, any>;
  temperature?: number;
  documentIds?: string[];
}

/**
 * Document Q&A source
 */
export interface DocumentQASource {
  documentId: string;
  documentName: string;
  content: string;
  score: number;
}

/**
 * Document Q&A query output
 */
export interface DocumentQAQueryOutput {
  answer: string;
  sources: DocumentQASource[];
  processingTimeMs: number;
}
