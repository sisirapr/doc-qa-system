import { createError, measureExecutionTime, validateInput } from '../utils/mcp-helpers';
import { VectorSimilaritySearchInput, VectorSimilaritySearchOutput, MCPError } from '../types/mcp-types';
import { SearchResult } from '../../types';
import { env } from '../../config/environment';
import { searchSimilar } from '../../services/vector';
import { generateEmbedding } from './document-processor';

/**
 * Perform vector similarity search
 * @param input Search input parameters
 * @returns Search results
 */
export async function vectorSimilaritySearch(
  input: VectorSimilaritySearchInput
): Promise<VectorSimilaritySearchOutput> {
  try {
    // Validate required fields
    validateInput(input, ['query']);
    
    // Set default values
    const limit = input.limit || 10;
    const threshold = input.threshold || 0.7;
    const filters = input.filters || {};
    
    // Measure execution time
    const [results, processingTime] = await measureExecutionTime(async () => {
      // Generate embedding for the query
      const queryEmbedding = await generateEmbedding(input.query);
      
      // Search for similar vectors
      const searchResults = await searchSimilar(queryEmbedding, limit, {
        must: [
          ...Object.entries(filters).map(([key, value]) => ({
            key,
            match: { value }
          }))
        ]
      });

      // Filter by threshold after search
      const filteredResults = searchResults.filter(result => result.score >= threshold);

      // Convert to VectorSimilaritySearchOutput format
      return filteredResults.map(result => ({
        id: result.id,
        score: result.score,
        content: result.payload.content,
        metadata: {
          documentId: result.payload.document_id,
          documentName: result.payload.document_name,
          chunkIndex: result.payload.chunk_index,
          mimeType: result.payload.metadata.mime_type,
          fileSize: result.payload.metadata.file_size,
          createdAt: result.payload.metadata.created_at,
          updatedAt: result.payload.metadata.updated_at,
          googleDriveId: result.payload.metadata.google_drive_id
        }
      }));
    });
    
    console.log(`Vector search completed in ${processingTime}ms, found ${results.length} results`);
    
    return {
      results,
      totalResults: results.length,
      processingTimeMs: processingTime
    };
  } catch (error) {
    console.error('Error performing vector search:', error);
    
    if (error instanceof MCPError) {
      throw error;
    }
    
    throw createError(
      'Failed to perform vector search',
      'VECTOR_SEARCH_ERROR',
      500,
      { originalError: (error as Error).message }
    );
  }
}
