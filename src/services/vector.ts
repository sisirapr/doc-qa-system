import { qdrantClient, COLLECTION_NAME, COLLECTION_CONFIG, ChunkPayload, SearchResult } from '../config/qdrant';
import { createError } from '../mcp/utils/mcp-helpers';
import { QdrantClient } from '@qdrant/js-client-rest';

/**
 * Initialize Qdrant collection
 */
export async function initializeCollection(): Promise<void> {
  try {
    // Delete collection if it exists
    try {
      await qdrantClient.deleteCollection(COLLECTION_NAME);
      console.log(`Deleted existing collection: ${COLLECTION_NAME}`);
    } catch (error) {
      console.log('Collection did not exist:', COLLECTION_NAME);
    }

    // Create collection with full configuration
    const config = {
      vectors: {
        size: COLLECTION_CONFIG.vectors.size,
        distance: "Cosine" as const
      },
      shard_number: 1,
      replication_factor: 1,
      write_consistency_factor: 1,
      on_disk_payload: true,
      hnsw_config: {
        m: 16,
        ef_construct: 100,
        full_scan_threshold: 10000
      },
      optimizers_config: {
        deleted_threshold: 0.2,
        vacuum_min_vector_number: 1000,
        default_segment_number: 2,
        indexing_threshold: 10000
      },
      wal_config: {
        wal_capacity_mb: 32,
        wal_segments_ahead: 0
      }
    };
    await qdrantClient.createCollection(COLLECTION_NAME, config);
    console.log(`Created collection: ${COLLECTION_NAME}`);
  } catch (error) {
    console.error('Error initializing Qdrant collection:', error);
    throw createError(
      'Failed to initialize vector database',
      'VECTOR_DB_ERROR',
      500,
      { originalError: (error as Error).message }
    );
  }
}

/**
 * Upsert vectors into Qdrant
 * @param vectors Vectors to upsert
 * @param payloads Payloads for vectors
 * @returns Number of vectors upserted
 */
export async function upsertVectors(
  vectors: number[][],
  payloads: ChunkPayload[]
): Promise<number> {
  try {
    // Create points from vectors and payloads
    console.log('Vector size:', vectors[0].length);
    console.log('Vectors:', JSON.stringify(vectors[0].slice(0, 5)));
    console.log('Payloads:', JSON.stringify(payloads[0]));
    console.log('Collection name:', COLLECTION_NAME);
    console.log('Collection config:', JSON.stringify(COLLECTION_CONFIG, null, 2));
    
    // Verify collection exists
    const collections = await qdrantClient.getCollections();
    console.log('Available collections:', collections.collections.map(c => c.name));
    
    const exists = collections.collections.some(c => c.name === COLLECTION_NAME);
    if (!exists) {
      console.error('Collection does not exist:', COLLECTION_NAME);
      throw new Error(`Collection ${COLLECTION_NAME} does not exist`);
    }
    
    // Normalize vectors before mapping
    const normalizedVectors = vectors.map(vector => {
      const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
      return vector.map(val => val / magnitude);
    });
    
    const points = normalizedVectors.map((vector, index) => {
      // Create a unique numeric ID from document ID and chunk index
      const idStr = `${payloads[index].document_id}_${payloads[index].chunk_index || 0}`;
      const id = Math.abs(Array.from(idStr).reduce((acc, char) => acc + char.charCodeAt(0), 0));
      console.log('Generated ID:', id, 'from string:', idStr);
      
      const point = {
        id,
        vector,
        payload: {
          document_id: payloads[index].document_id,
          document_name: payloads[index].document_name || "",
          chunk_index: payloads[index].chunk_index || 0,
          content: payloads[index].content,
          metadata: {
            file_size: payloads[index].metadata?.file_size || 0,
            created_at: payloads[index].metadata?.created_at || new Date().toISOString(),
            updated_at: payloads[index].metadata?.updated_at || new Date().toISOString(),
            google_drive_id: payloads[index].metadata?.google_drive_id || "",
            mime_type: payloads[index].metadata?.mime_type || "text/plain"
          }
        }
      };
      console.log('Created point:', JSON.stringify(point, null, 2));
      return point;
    });

    console.log('Upserting points:', JSON.stringify(points[0], null, 2));

    // Upsert points one at a time with retries
    for (const point of points) {
      let retries = 3;
      while (retries > 0) {
        try {
          console.log('Upserting point:', JSON.stringify(point, null, 2));
          console.log('Vector size:', point.vector.length);
          console.log('Vector sample:', point.vector.slice(0, 5));
          
          const response = await qdrantClient.upsert(COLLECTION_NAME, {
            wait: true,
            points: [
              {
                id: point.id,
                vector: point.vector,
                payload: point.payload
              }
            ]
          });
          console.log('Upsert response:', JSON.stringify(response, null, 2));
          console.log('Upsert response:', JSON.stringify(response, null, 2));
          
          // Verify point was inserted
          const retrieved = await qdrantClient.retrieve(COLLECTION_NAME, { 
            ids: [point.id],
            with_payload: true,
            with_vector: true
          });
          console.log('Retrieved point:', retrieved.length > 0 ? JSON.stringify(retrieved[0], null, 2) : 'Not found');
          
          if (retrieved.length > 0) {
            console.log('Point verified successfully');
            break;
          }
          throw new Error('Point verification failed');
        } catch (error) {
          console.error('Error upserting point:', error);
          console.error('Error details:', error.message);
          console.error('Error stack:', error.stack);
          retries--;
          if (retries === 0) throw error;
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

    return points.length;
  } catch (error) {
    console.error('Error upserting vectors:', error);
    throw createError(
      'Failed to store vectors in database',
      'VECTOR_DB_ERROR',
      500,
      { originalError: (error as Error).message }
    );
  }
}

/**
 * Search for similar vectors in Qdrant
 * @param vector Query vector
 * @param limit Maximum number of results
 * @param filter Optional filter conditions
 * @returns Array of search results
 */
export async function searchSimilar(
  vector: number[],
  limit: number = 5,
  filter?: Record<string, any>
): Promise<SearchResult[]> {
  try {
    const response = await qdrantClient.search(COLLECTION_NAME, {
      vector,
      limit,
      filter,
      with_payload: true,
      with_vector: false
    });

      return response.map(hit => ({
        id: String(hit.id),
        score: hit.score,
        payload: {
          document_id: (hit.payload as any).document_id,
          document_name: (hit.payload as any).document_name,
          chunk_index: (hit.payload as any).chunk_index,
          content: (hit.payload as any).content,
          metadata: {
            file_size: (hit.payload as any).metadata.file_size,
            created_at: (hit.payload as any).metadata.created_at,
            updated_at: (hit.payload as any).metadata.updated_at,
            google_drive_id: (hit.payload as any).metadata.google_drive_id,
            mime_type: (hit.payload as any).metadata.mime_type
          }
        },
        vector: Array.isArray(hit.vector) ? hit.vector as number[] : []
      }));
  } catch (error) {
    console.error('Error searching vectors:', error);
    throw createError(
      'Failed to search vector database',
      'VECTOR_DB_ERROR',
      500,
      { originalError: (error as Error).message }
    );
  }
}

/**
 * Delete vectors from Qdrant
 * @param documentId Document ID to delete vectors for
 * @returns Number of vectors deleted
 */
export async function deleteVectors(documentId: string): Promise<number> {
  try {
    const response = await qdrantClient.delete(COLLECTION_NAME, {
      filter: {
        must: [
          {
            key: 'document_id',
            match: { value: documentId }
          }
        ]
      },
      wait: true
    });

    return response.status === 'completed' ? 1 : 0;
  } catch (error) {
    console.error('Error deleting vectors:', error);
    throw createError(
      'Failed to delete vectors from database',
      'VECTOR_DB_ERROR',
      500,
      { originalError: (error as Error).message }
    );
  }
}

// Initialize collection on service startup
initializeCollection().catch(console.error);
