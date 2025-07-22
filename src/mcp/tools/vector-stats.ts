import { createError, measureExecutionTime } from '../utils/mcp-helpers';
import { MCPError } from '../types/mcp-types';
import { qdrantClient } from '../../config/qdrant';

/**
 * Get vector database statistics
 * @returns Statistics about documents and vectors
 */
export async function getVectorStats(): Promise<{
  totalDocuments: number;
  totalVectors: number;
  collections: number;
  lastUpdated: string;
}> {
  try {
    const [stats, processingTime] = await measureExecutionTime(async () => {
      // Get collection info
      const collectionInfo = await qdrantClient.getCollection('document_chunks');
      
      // Get unique document count by aggregating unique document_ids
      const scrollResult = await qdrantClient.scroll('document_chunks', {
        limit: 10000, // Get a large sample to count unique documents
        with_payload: true,
        with_vector: false
      });

      // Count unique documents
      const uniqueDocuments = new Set();
      scrollResult.points.forEach(point => {
        if (point.payload?.document_id) {
          uniqueDocuments.add(point.payload.document_id);
        }
      });

      return {
        totalDocuments: uniqueDocuments.size,
        totalVectors: collectionInfo.points_count || 0,
        collections: 1, // We have one collection: document_chunks
        lastUpdated: new Date().toISOString()
      };
    });

    console.log(`Vector stats retrieved in ${processingTime}ms`);
    return stats;
  } catch (error) {
    console.error('Error getting vector stats:', error);
    
    if (error instanceof MCPError) {
      throw error;
    }
    
    // Return default stats if there's an error
    return {
      totalDocuments: 0,
      totalVectors: 0,
      collections: 0,
      lastUpdated: new Date().toISOString()
    };
  }
}

export const vectorStatsTool = {
  name: 'vector_stats',
  description: 'Get statistics about documents and vectors in the database',
  inputSchema: {
    type: 'object',
    properties: {},
    required: []
  }
};
