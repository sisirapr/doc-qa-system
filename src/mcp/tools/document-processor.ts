import { createError, measureExecutionTime, validateInput } from '../utils/mcp-helpers';
import { DocumentChunkAndEmbedInput, DocumentChunkAndEmbedOutput, MCPError } from '../types/mcp-types';
import { DocumentChunk, EmbeddedChunk, ChunkMetadata } from '../../types';
import { env } from '../../config/environment';

// Default chunking parameters
const DEFAULT_CHUNK_SIZE = 1000;
const DEFAULT_CHUNK_OVERLAP = 200;
const MIN_CHUNK_SIZE = 100;
const MAX_CHUNK_SIZE = 8000;

// Default embedding model
const DEFAULT_EMBEDDING_MODEL = 'mock-embedding-model';

/**
 * Process and embed document content
 * @param input Document processing input
 * @returns Processed document chunks with embeddings
 */
export async function documentChunkAndEmbed(
  input: DocumentChunkAndEmbedInput
): Promise<DocumentChunkAndEmbedOutput> {
  try {
    // Validate required fields
    validateInput(input, ['documentId', 'content', 'mimeType']);
    
    // Validate chunk size
    const chunkSize = input.chunkSize || DEFAULT_CHUNK_SIZE;
    if (chunkSize < MIN_CHUNK_SIZE || chunkSize > MAX_CHUNK_SIZE) {
      throw createError(
        `Chunk size must be between ${MIN_CHUNK_SIZE} and ${MAX_CHUNK_SIZE}`,
        'INVALID_CHUNK_SIZE',
        400
      );
    }
    
    // Validate chunk overlap
    const chunkOverlap = input.chunkOverlap || DEFAULT_CHUNK_OVERLAP;
    if (chunkOverlap >= chunkSize) {
      throw createError(
        'Chunk overlap must be less than chunk size',
        'INVALID_CHUNK_OVERLAP',
        400
      );
    }
    
    // Create a document name from the document ID
    const documentName = `Document-${input.documentId}`;
    
    // Step 1: Split document into chunks
    const [chunks, chunkingTime] = await measureExecutionTime(async () => {
      const rawChunks = splitTextIntoChunks(
        input.content,
        chunkSize,
        chunkOverlap,
        documentName
      );
      
      return rawChunks;
    });
    
    console.log(`Document chunking completed in ${chunkingTime}ms, ${chunks.length} chunks created`);
    
    // Step 2: Generate embeddings for each chunk
    const [embeddedChunks, embeddingTime] = await measureExecutionTime(async () => {
      return await generateEmbeddings(chunks, input.documentId);
    });
    
    console.log(`Embedding generation completed in ${embeddingTime}ms`);
    
    // Get dimensions from the vector field
    const dimensions = embeddedChunks.length > 0 ? embeddedChunks[0].vector.length : 0;
    
    // Get the embedding model from environment or use default
    let embeddingModel = DEFAULT_EMBEDDING_MODEL;
    if (typeof env === 'object' && env !== null && typeof env.EMBEDDING_MODEL === 'string') {
      embeddingModel = env.EMBEDDING_MODEL;
    }
    
    return {
      documentId: input.documentId,
      chunks: embeddedChunks,
      totalChunks: embeddedChunks.length,
      embeddingModel,
      dimensions
    };
  } catch (error) {
    console.error('Error processing document:', error);
    
    if (error instanceof MCPError) {
      throw error;
    }
    
    throw createError(
      'Failed to process document',
      'DOCUMENT_PROCESSING_ERROR',
      500,
      { originalError: (error as Error).message }
    );
  }
}

/**
 * Split text into chunks with overlap
 * @param text Text to split
 * @param chunkSize Size of each chunk
 * @param chunkOverlap Overlap between chunks
 * @param documentName Document name for metadata
 * @returns Array of document chunks
 */
function splitTextIntoChunks(
  text: string,
  chunkSize: number,
  chunkOverlap: number,
  documentName: string
): Array<Omit<DocumentChunk, 'id' | 'documentId'>> {
  // Handle empty or very small text
  if (!text || text.trim().length === 0) {
    throw createError(
      'Empty document content',
      'EMPTY_DOCUMENT',
      400
    );
  }
  
  // For a single chunk case
  if (text.length <= chunkSize) {
    const metadata: ChunkMetadata = {
      documentName,
      chunkIndex: 0,
      totalChunks: 1
    };
    
    return [{
      content: text,
      index: 0,
      startOffset: 0,
      endOffset: text.length,
      metadata
    }];
  }
  
  const chunks: Array<Omit<DocumentChunk, 'id' | 'documentId'>> = [];
  let startIndex = 0;
  let chunkIndex = 0;
  
  while (startIndex < text.length) {
    // Calculate end index for this chunk
    let endIndex = startIndex + chunkSize;
    
    // Don't go beyond text length
    if (endIndex > text.length) {
      endIndex = text.length;
    } else {
      // Try to find a sentence boundary to end on
      const possibleBoundary = findSentenceBoundary(text, endIndex);
      if (possibleBoundary > startIndex) {
        endIndex = possibleBoundary;
      }
    }
    
    // Extract chunk content
    const chunkContent = text.substring(startIndex, endIndex);
    
    // Add chunk if it's not empty
    if (chunkContent.trim().length > 0) {
      const metadata: ChunkMetadata = {
        documentName,
        chunkIndex,
        totalChunks: -1 // Will be updated after all chunks are created
      };
      
      chunks.push({
        content: chunkContent,
        index: chunkIndex,
        startOffset: startIndex,
        endOffset: endIndex,
        metadata
      });
      
      chunkIndex++;
    }
    
    // Move to next chunk start position, accounting for overlap
    startIndex = endIndex - chunkOverlap;
    
    // Ensure we make progress
    if (startIndex >= text.length || startIndex <= 0) {
      break;
    }
  }
  
  // Update total chunks count in metadata
  const totalChunks = chunks.length;
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    if (chunk && chunk.metadata) {
      chunk.metadata.totalChunks = totalChunks;
    }
  }
  
  return chunks;
}

/**
 * Find a sentence boundary near the given index
 * @param text Text to search in
 * @param index Index to search around
 * @returns Index of sentence boundary or original index
 */
function findSentenceBoundary(text: string, index: number): number {
  // Look for sentence boundaries within a reasonable range
  const searchRange = 100; // Look 100 chars before and after
  const startSearch = Math.max(0, index - searchRange);
  const endSearch = Math.min(text.length, index + searchRange);
  
  // Search backward for sentence boundary
  for (let i = index; i >= startSearch; i--) {
    if (isSentenceBoundary(text, i)) {
      return i + 1; // Return position after the boundary
    }
  }
  
  // Search forward for sentence boundary
  for (let i = index; i < endSearch; i++) {
    if (isSentenceBoundary(text, i)) {
      return i + 1; // Return position after the boundary
    }
  }
  
  // No good boundary found, return original index
  return index;
}

/**
 * Check if position is a sentence boundary
 * @param text Text to check
 * @param index Index to check
 * @returns True if position is a sentence boundary
 */
function isSentenceBoundary(text: string, index: number): boolean {
  if (index < 0 || index >= text.length) {
    return false;
  }
  
  // Check for sentence-ending punctuation followed by space or end of text
  const sentenceEnders = ['.', '!', '?'];
  
  return (
    sentenceEnders.includes(text[index]) &&
    (index === text.length - 1 || /\s/.test(text[index + 1]))
  );
}

/**
 * Generate embeddings for document chunks
 * @param chunks Document chunks
 * @param documentId Document ID
 * @returns Embedded chunks
 */
async function generateEmbeddings(
  chunks: Array<Omit<DocumentChunk, 'id' | 'documentId'>>,
  documentId: string
): Promise<EmbeddedChunk[]> {
  // This is a placeholder for actual embedding generation
  // In a real implementation, this would call an embedding API like OpenAI
  
  // For now, we'll generate mock embeddings
  // In a real implementation, replace this with actual API calls
  const embeddedChunks: EmbeddedChunk[] = [];
  
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    if (!chunk) continue;
    
    // Ensure content is a string
    const content = typeof chunk.content === 'string' ? chunk.content : '';
    
    // Mock embedding generation
    const embedding = await mockGenerateEmbedding(content);
    
    // Create the embedded chunk with all required properties
    embeddedChunks.push({
      ...chunk,
      id: `${documentId}-chunk-${i}`,
      documentId,
      vector: embedding,
      embedding
    });
  }
  
  return embeddedChunks;
}

/**
 * Mock function to generate embeddings
 * @param text Text to embed
 * @returns Mock embedding vector
 */
async function mockGenerateEmbedding(text: string): Promise<number[]> {
  // In a real implementation, this would call an embedding API
  // For now, generate a deterministic mock embedding based on text content
  
  // Ensure text is a non-empty string
  const safeText = typeof text === 'string' && text.length > 0 
    ? text 
    : 'default-text';
  
  // Use a simple hash function to generate a seed from the text
  let seed = 0;
  for (let i = 0; i < safeText.length; i++) {
    seed += safeText.charCodeAt(i);
  }
  
  // Generate a mock embedding vector with 384 dimensions (common for text embeddings)
  const dimensions = 384;
  const embedding: number[] = [];
  
  for (let i = 0; i < dimensions; i++) {
    // Generate a deterministic but seemingly random value between -1 and 1
    const value = Math.sin(seed * (i + 1)) / 2;
    embedding.push(value);
  }
  
  // Normalize the embedding vector
  let magnitude = 0;
  for (let i = 0; i < embedding.length; i++) {
    magnitude += embedding[i] * embedding[i];
  }
  magnitude = Math.sqrt(magnitude);
  
  // Avoid division by zero
  if (magnitude === 0) {
    return Array(dimensions).fill(0);
  }
  
  // Normalize
  for (let i = 0; i < embedding.length; i++) {
    embedding[i] = embedding[i] / magnitude;
  }
  
  return embedding;
}

/**
 * Extract text from various document formats
 * @param content Document content
 * @param mimeType Document MIME type
 * @returns Extracted text
 */
export function extractTextFromDocument(
  content: Buffer,
  mimeType: string
): string {
  // This is a placeholder for actual text extraction
  // In a real implementation, this would use libraries like pdf-parse, mammoth, etc.
  
  // For now, assume content is already text
  if (mimeType.startsWith('text/')) {
    return content.toString('utf-8');
  }
  
  // For other formats, return a placeholder message
  // In a real implementation, this would extract text from various formats
  return `[Text extraction from ${mimeType} not implemented]`;
}
