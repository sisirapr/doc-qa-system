import { QdrantClient } from '@qdrant/js-client-rest';
import { env } from './environment';

// Initialize Qdrant client
export const qdrantClient = new QdrantClient({
  url: 'http://127.0.0.1:6333',
  checkCompatibility: true,
  timeout: 10000
});

// Log client initialization
console.log('Qdrant client initialized with config:', {
  url: 'http://127.0.0.1:6333',
  checkCompatibility: true,
  timeout: 10000
});

// Collection configuration
export const COLLECTION_NAME = 'document_chunks';
export const VECTOR_SIZE = 10; // Size of our embeddings

// Collection configuration
export const COLLECTION_CONFIG = {
  name: COLLECTION_NAME,
  vectors: {
    size: VECTOR_SIZE,
    distance: 'Cosine'
  },
  on_disk: true,
  optimizers_config: {
    default_segment_number: 2
  },
  replication_factor: 1,
  write_consistency_factor: 1,
  payload_schema: {
    document_id: { type: "keyword" },
    document_name: { type: "keyword" },
    chunk_index: { type: "integer" },
    content: { type: "text" },
    metadata: { type: "object" }
  }
};

// Payload schema for document chunks
export interface ChunkPayload {
  document_id: string;
  document_name: string;
  chunk_index: number;
  content: string;
  metadata: {
    file_size: number;
    created_at: string;
    updated_at: string;
    google_drive_id?: string;
    mime_type: string;
  };
}

// Search result interface
export interface SearchResult {
  id: string;
  score: number;
  payload: ChunkPayload;
  vector: number[];
}
