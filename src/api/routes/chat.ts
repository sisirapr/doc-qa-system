import { Router } from 'express';
import axios from 'axios';

const router = Router();

// MCP Server URL
const MCP_SERVER_URL = 'http://localhost:3001';

/**
 * POST /api/chat/query
 * Ask questions about documents
 */
router.post('/query', async (req, res) => {
  try {
    const { query, maxResults = 5 } = req.body;
    
    if (!query) {
      res.status(400).json({
        success: false,
        error: {
          message: 'Query is required',
          code: 'MISSING_QUERY'
        },
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id']
        }
      });
      return;
    }

    // Call MCP server for document Q&A
    const response = await axios.post(`${MCP_SERVER_URL}/tools/document_qa_query`, {
      query,
      maxResults
    });

    if (!response.data.success) {
      throw new Error(response.data.error?.message || 'Q&A query failed');
    }

    const { answer, sources, processingTimeMs } = response.data.data;

    res.json({
      success: true,
      data: {
        query,
        answer,
        sources: sources || [],
        confidence: sources && sources.length > 0 ? 'high' : 'low',
        processingTime: {
          total: processingTimeMs,
          unit: 'ms'
        }
      },
      metadata: {
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'],
        model: 'anthropic/claude-3-haiku',
        vectorSearch: {
          maxResults,
          foundSources: sources ? sources.length : 0
        }
      }
    });
  } catch (error) {
    const err = error as any;
    console.error('Chat query error:', err);
    
    res.status(err.response?.status || 500).json({
      success: false,
      error: {
        message: err.message || 'Failed to process query',
        code: 'CHAT_QUERY_ERROR',
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
 * POST /api/chat/search
 * Search for similar document chunks
 */
router.post('/search', async (req, res) => {
  try {
    const { query, maxResults = 10, threshold = 0.7 } = req.body;
    
    if (!query) {
      res.status(400).json({
        success: false,
        error: {
          message: 'Query is required',
          code: 'MISSING_QUERY'
        },
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id']
        }
      });
      return;
    }

    // Call MCP server for vector similarity search
    const response = await axios.post(`${MCP_SERVER_URL}/tools/vector_similarity_search`, {
      query,
      maxResults,
      threshold
    });

    if (!response.data.success) {
      throw new Error(response.data.error?.message || 'Vector search failed');
    }

    const { results, processingTimeMs } = response.data.data;

    res.json({
      success: true,
      data: {
        query,
        results: results || [],
        totalResults: results ? results.length : 0,
        processingTime: {
          total: processingTimeMs,
          unit: 'ms'
        }
      },
      metadata: {
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'],
        searchParams: {
          maxResults,
          threshold
        }
      }
    });
  } catch (error) {
    const err = error as any;
    console.error('Vector search error:', err);
    
    res.status(err.response?.status || 500).json({
      success: false,
      error: {
        message: err.message || 'Failed to search documents',
        code: 'VECTOR_SEARCH_ERROR',
        details: err.response?.data
      },
      metadata: {
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id']
      }
    });
  }
});

export { router as chatRouter };
