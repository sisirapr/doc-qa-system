import { qdrantClient } from '../../config/qdrant';
import { createError } from '../utils/mcp-helpers';

/**
 * Reset Knowledge Base Tool
 * Clears all documents and vectors from the knowledge base
 */
export async function resetKnowledgeBase(input: any) {
  try {
    console.log('Starting knowledge base reset...');
    
    const collectionName = 'document_chunks';
    let deletedDocuments = 0;
    let deletedVectors = 0;
    
    try {
      // Get current statistics before reset
      const collectionInfo = await qdrantClient.getCollection(collectionName);
      console.log('Collection info before reset:', collectionInfo);
      
      // Get actual vector count by scrolling through all points
      const scrollResult = await qdrantClient.scroll(collectionName, {
        limit: 10000, // Increase limit to get all points
        with_payload: true,
        with_vector: false
      });
      
      console.log(`Found ${scrollResult.points.length} points in collection`);
      
      // Count vectors (each point is a vector)
      deletedVectors = scrollResult.points.length;
      
      // Count unique documents
      const uniqueDocuments = new Set();
      scrollResult.points.forEach(point => {
        if (point.payload?.document_id) {
          uniqueDocuments.add(point.payload.document_id);
        }
      });
      deletedDocuments = uniqueDocuments.size;
      
      console.log(`Before reset: ${deletedDocuments} documents, ${deletedVectors} vectors`);
      
    } catch (error) {
      console.log('Collection does not exist or is empty, nothing to reset');
    }
    
    try {
      // Delete the entire collection
      await qdrantClient.deleteCollection(collectionName);
      console.log(`Deleted collection: ${collectionName}`);
    } catch (error) {
      console.log('Collection already deleted or does not exist');
    }
    
    try {
      // Recreate the collection with the same configuration
      await qdrantClient.createCollection(collectionName, {
        vectors: {
          size: 1536, // OpenAI text-embedding-3-small dimension
          distance: 'Cosine'
        }
      });
      console.log(`Recreated collection: ${collectionName}`);
    } catch (error) {
      console.error('Error recreating collection:', error);
      throw createError(
        'Failed to recreate collection after reset',
        'COLLECTION_RECREATION_ERROR',
        500,
        { originalError: error }
      );
    }
    
    const result = {
      status: 'success',
      message: 'Knowledge base has been successfully reset',
      deletedDocuments,
      deletedVectors,
      collectionName,
      resetTime: new Date().toISOString()
    };
    
    console.log('Knowledge base reset completed:', result);
    return result;
    
  } catch (error) {
    console.error('Error resetting knowledge base:', error);
    
    if (error.message?.includes('COLLECTION_RECREATION_ERROR')) {
      throw error;
    }
    
    throw createError(
      'Failed to reset knowledge base',
      'KNOWLEDGE_BASE_RESET_ERROR',
      500,
      { originalError: error }
    );
  }
}
