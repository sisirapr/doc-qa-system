import { Router } from 'express';
import axios from 'axios';

const router = Router();

// MCP Server URL
const MCP_SERVER_URL = 'http://localhost:3001';

/**
 * POST /api/sync/google-drive
 * Sync documents from Google Drive
 */
router.post('/google-drive', async (req, res) => {
  try {
    const { folderId, maxFiles = 50 } = req.body;
    
    // Step 1: List files from Google Drive
    const listResponse = await axios.post(`${MCP_SERVER_URL}/tools/google_drive_list_files`, {
      folderId,
      maxResults: maxFiles
    });

    if (!listResponse.data.success) {
      throw new Error(listResponse.data.error?.message || 'Failed to list Google Drive files');
    }

    const { files, metadata } = listResponse.data.data;
    
    if (!files || files.length === 0) {
      res.json({
        success: true,
        data: {
          status: 'completed',
          totalFiles: 0,
          processedFiles: 0,
          skippedFiles: 0,
          errors: [],
          message: 'No supported files found in Google Drive'
        },
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'],
          googleDriveMetadata: metadata
        }
      });
      return;
    }

    // Step 2: Process each file
    const results = [];
    const errors = [];
    let processedCount = 0;
    let skippedCount = 0;

    for (const file of files) {
      try {
        console.log(`Processing file: ${file.name} (${file.id})`);
        
        // Download file
        const downloadResponse = await axios.post(`${MCP_SERVER_URL}/tools/google_drive_download_file`, {
          fileId: file.id
        });

        if (!downloadResponse.data.success) {
          throw new Error(downloadResponse.data.error?.message || 'Failed to download file');
        }

        const { content, fileName, mimeType } = downloadResponse.data.data;
        
        // Convert buffer to string for text files
        const textContent = Buffer.isBuffer(content) ? content.toString('utf-8') : content;
        
        // Process document
        const processResponse = await axios.post(`${MCP_SERVER_URL}/tools/document_chunk_and_embed`, {
          documentId: `gdrive_${file.id}`,
          content: textContent,
          mimeType
        });

        if (!processResponse.data.success) {
          throw new Error(processResponse.data.error?.message || 'Failed to process document');
        }

        const { chunks } = processResponse.data.data;
        
        results.push({
          fileId: file.id,
          fileName: file.name,
          status: 'processed',
          chunks: chunks.length,
          size: file.size,
          mimeType: file.mimeType
        });
        
        processedCount++;
        
      } catch (error) {
        const err = error as Error;
        console.error(`Error processing file ${file.name}:`, err.message);
        
        errors.push({
          fileId: file.id,
          fileName: file.name,
          error: err.message
        });
        
        skippedCount++;
      }
    }

    res.json({
      success: true,
      data: {
        status: 'completed',
        totalFiles: files.length,
        processedFiles: processedCount,
        skippedFiles: skippedCount,
        results,
        errors,
        summary: {
          successRate: `${Math.round((processedCount / files.length) * 100)}%`,
          totalChunks: results.reduce((sum, r) => sum + r.chunks, 0),
          totalSize: results.reduce((sum, r) => sum + r.size, 0)
        }
      },
      metadata: {
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'],
        googleDriveMetadata: metadata,
        processingTime: 'calculated_on_client'
      }
    });
    
  } catch (error) {
    const err = error as any;
    console.error('Google Drive sync error:', err);
    
    res.status(err.response?.status || 500).json({
      success: false,
      error: {
        message: err.message || 'Failed to sync from Google Drive',
        code: 'GOOGLE_DRIVE_SYNC_ERROR',
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
 * GET /api/sync/status
 * Get sync status (placeholder)
 */
router.get('/status', async (req, res) => {
  try {
    // TODO: Implement actual sync status tracking
    
    res.json({
      success: true,
      data: {
        lastSync: null,
        status: 'idle',
        totalDocuments: 0,
        message: 'Sync status tracking not yet implemented'
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
        message: 'Failed to get sync status',
        code: 'SYNC_STATUS_ERROR',
        details: err.message
      },
      metadata: {
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id']
      }
    });
  }
});

export { router as syncRouter };
