// Core domain types
export interface Document {
  id: string;
  name: string;
  content: string;
  mimeType: string;
  size: number;
  googleDriveId?: string;
  createdAt: Date;
  updatedAt: Date;
  metadata: DocumentMetadata;
}

export interface DocumentMetadata {
  fileSize: number;
  createdAt: string;
  updatedAt: string;
  googleDriveId?: string;
  mimeType: string;
  chunkCount?: number;
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  content: string;
  index: number;
  startOffset: number;
  endOffset: number;
  metadata: ChunkMetadata;
}

export interface ChunkMetadata {
  documentName: string;
  chunkIndex: number;
  totalChunks: number;
}

export interface EmbeddedChunk extends DocumentChunk {
  vector: number[];
  embedding?: number[];
}

export interface SearchQuery {
  query: string;
  limit?: number;
  threshold?: number;
  filters?: Record<string, any>;
}

export interface SearchResult {
  chunk: DocumentChunk;
  score: number;
  document: Document;
}

export interface QAResponse {
  answer: string;
  sources: SearchResult[];
  confidence: number;
  metadata: {
    model: string;
    tokensUsed: number;
    processingTime: number;
  };
}

// Configuration types
export interface DatabaseConfig {
  url: string;
  apiKey?: string;
  collectionName: string;
}

export interface GoogleDriveConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  refreshToken?: string;
}

export interface LLMConfig {
  provider: 'openai' | 'anthropic';
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
}

export interface EmbeddingConfig {
  provider: 'openai';
  apiKey: string;
  model: string;
  dimensions: number;
}

// Error types
export class DocumentError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'DocumentError';
  }
}

export class VectorError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'VectorError';
  }
}

export class GoogleDriveError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'GoogleDriveError';
  }
}

// Retry configuration
export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrors: string[];
}

// API Response types
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
    processingTime: number;
  };
}

export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  services: {
    database: 'connected' | 'disconnected';
    googleDrive: 'connected' | 'disconnected';
    llm: 'connected' | 'disconnected';
  };
  uptime: number;
  version: string;
}
