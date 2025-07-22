import { Router } from 'express';
import axios from 'axios';

const router = Router();

// MCP Server URL
const MCP_SERVER_URL = 'http://localhost:3001';

/**
 * POST /api/documents/ingest
 * Ingest documents for processing
 */
router.post('/ingest', async (req, res) => {
  try {
    const { documentId, content, mimeType = 'text/plain' } = req.body;
    
    if (!documentId || !content) {
      res.status(400).json({
        success: false,
        error: {
          message: 'documentId and content are required',
          code: 'MISSING_REQUIRED_FIELDS'
        },
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id']
        }
      });
      return;
    }

    // Call MCP server for document processing
    const response = await axios.post(`${MCP_SERVER_URL}/tools/document_chunk_and_embed`, {
      documentId,
      content,
      mimeType
    });

    if (!response.data.success) {
      throw new Error(response.data.error?.message || 'Document ingestion failed');
    }

    const { chunks, processingTimeMs } = response.data.data;

    res.json({
      success: true,
      data: {
        documentId,
        status: 'processed',
        chunks: chunks.length,
        totalCharacters: content.length,
        processingTime: {
          total: processingTimeMs,
          unit: 'ms'
        },
        chunkDetails: chunks.map((chunk: any) => ({
          id: chunk.id,
          index: chunk.index,
          length: chunk.content.length,
          startOffset: chunk.startOffset,
          endOffset: chunk.endOffset
        }))
      },
      metadata: {
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'],
        mimeType,
        embeddingModel: 'openai/text-embedding-3-small'
      }
    });
  } catch (error) {
    const err = error as any;
    console.error('Document ingestion error:', err);
    
    res.status(err.response?.status || 500).json({
      success: false,
      error: {
        message: err.message || 'Failed to ingest document',
        code: 'DOCUMENT_INGESTION_ERROR',
        details: err.response?.data
      },
      metadata: {
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id']
      }
    });
  }
});

/**
 * GET /api/documents/stats
 * Get document and vector statistics
 */
router.get('/stats', async (req, res) => {
  try {
    // Call MCP server to get vector statistics
    const response = await axios.post(`${MCP_SERVER_URL}/tools/vector_stats`, {});
    
    if (!response.data.success) {
      throw new Error(response.data.error?.message || 'Failed to get statistics');
    }

    const stats = response.data.data;

    res.json({
      success: true,
      data: {
        documents: stats.totalDocuments || 0,
        vectors: stats.totalVectors || 0,
        collections: stats.collections || 0,
        lastUpdated: stats.lastUpdated || new Date().toISOString()
      },
      metadata: {
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id']
      }
    });
  } catch (error) {
    const err = error as any;
    console.error('Statistics fetch error:', err);
    
    // Return default stats if MCP server is not available
    res.json({
      success: true,
      data: {
        documents: 0,
        vectors: 0,
        collections: 0,
        lastUpdated: new Date().toISOString()
      },
      metadata: {
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'],
        note: 'Default statistics returned due to MCP server unavailability'
      }
    });
  }
});

/**
 * GET /api/documents
 * List processed documents (placeholder - would need database implementation)
 */
router.get('/', async (req, res) => {
  try {
    // TODO: Implement actual document listing from database
    // For now, return a placeholder response
    
    res.json({
      success: true,
      data: {
        documents: [],
        totalDocuments: 0,
        message: 'Document listing not yet implemented - documents are stored in vector database'
      },
      metadata: {
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id']
      }
    });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to list documents',
        code: 'DOCUMENT_LIST_ERROR',
        details: err.message
      },
      metadata: {
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id']
      }
    });
  }
});

/**
 * DELETE /api/documents/:documentId
 * Delete a document (placeholder)
 */
router.delete('/:documentId', async (req, res) => {
  try {
    const { documentId } = req.params;
    
    // TODO: Implement actual document deletion from vector database
    
    res.json({
      success: true,
      data: {
        documentId,
        status: 'deleted',
        message: 'Document deletion not yet implemented'
      },
      metadata: {
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id']
      }
    });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to delete document',
        code: 'DOCUMENT_DELETE_ERROR',
        details: err.message
      },
      metadata: {
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id']
      }
    });
  }
});

export { router as documentsRouter };
