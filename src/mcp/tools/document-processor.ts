import { createError, measureExecutionTime, validateInput } from '../utils/mcp-helpers';
import { DocumentChunkAndEmbedInput, DocumentChunkAndEmbedOutput, MCPError, EmbeddedChunk } from '../types/mcp-types';
import { env } from '../../config/environment';
import { VECTOR_SIZE } from '../../config/qdrant';

/**
 * Generate embedding for text
 * @param text Text to generate embedding for
 * @returns Embedding vector
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    // TODO: Replace with real embedding generation using OpenAI API
    // For now, generate a mock embedding vector
    return Array.from({ length: VECTOR_SIZE }, () => Math.random() * 2 - 1);
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw createError(
      'Failed to generate embedding',
      'EMBEDDING_ERROR',
      500,
      { originalError: (error as Error).message }
    );
  }
}

/**
 * Process and embed document
 * @param input Document processing input
 * @returns Processed document with embeddings
 */
export async function documentChunkAndEmbed(
  input: DocumentChunkAndEmbedInput
): Promise<DocumentChunkAndEmbedOutput> {
  try {
    // Validate required fields
    validateInput(input, ['documentId', 'content']);
    
    // Set default values
    const chunkSize = input.chunkSize || 1000;
    const chunkOverlap = input.chunkOverlap || 200;
    
    // Measure execution time
    const [result, processingTime] = await measureExecutionTime(async () => {
      // Split text into chunks
      const chunks = splitIntoChunks(input.content, chunkSize, chunkOverlap, input.documentId);
      
      // Generate embeddings for each chunk
      const embeddings = await Promise.all(
        chunks.map(chunk => generateEmbedding(chunk.content))
      );
      
      // Update chunks with embeddings and total chunks count
      chunks.forEach((chunk, index) => {
        chunk.vector = embeddings[index];
        chunk.metadata.totalChunks = chunks.length;
      });
      
      return { chunks };
    });
    
    console.log(`Document processing completed in ${processingTime}ms`);
    
    return {
      documentId: input.documentId,
      chunks: result.chunks,
      processingTimeMs: processingTime
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
 * Split text into chunks
 * @param text Text to split
 * @param chunkSize Size of each chunk
 * @param overlap Overlap between chunks
 * @returns Array of chunks
 */
function splitIntoChunks(
  text: string,
  chunkSize: number,
  overlap: number,
  documentId: string
): EmbeddedChunk[] {
  const chunks: EmbeddedChunk[] = [];
  
  // Split text into sentences
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  
  let currentChunk = '';
  let currentStartOffset = 0;
  
  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i].trim();
    
    // If adding this sentence would exceed chunk size
    if (currentChunk.length + sentence.length > chunkSize && currentChunk.length > 0) {
      // Save current chunk
      chunks.push({
        id: `${documentId}_${chunks.length}`,
        documentId,
        content: currentChunk.trim(),
        index: chunks.length,
        startOffset: currentStartOffset,
        endOffset: currentStartOffset + currentChunk.length,
        vector: [], // Will be filled later
        metadata: {
          chunkIndex: chunks.length,
          totalChunks: 0 // Will be updated after all chunks are created
        }
      });
      
      // Start new chunk with overlap
      const overlapStart = Math.max(0, currentChunk.length - overlap);
      currentChunk = currentChunk.slice(overlapStart) + sentence;
      currentStartOffset = currentStartOffset + overlapStart;
    } else {
      // Add sentence to current chunk
      currentChunk += (currentChunk ? ' ' : '') + sentence;
    }
  }
  
  // Add final chunk if not empty
  if (currentChunk.trim()) {
    chunks.push({
      id: `${documentId}_${chunks.length}`,
      documentId,
      content: currentChunk.trim(),
      index: chunks.length,
      startOffset: currentStartOffset,
      endOffset: currentStartOffset + currentChunk.length,
      vector: [], // Will be filled later
      metadata: {
        chunkIndex: chunks.length,
        totalChunks: 0 // Will be updated after all chunks are created
      }
    });
  }
  
  return chunks;
}
