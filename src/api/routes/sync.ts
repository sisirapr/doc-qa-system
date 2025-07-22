import { Router } from 'express';
import { googleDriveService } from '../../services/google-drive';
import axios from 'axios';

const router = Router();

// MCP Server URL
const MCP_SERVER_URL = 'http://localhost:3001';

/**
 * POST /api/sync/google-drive
 * Sync documents from Google Drive
 */
router.post('/google-drive', async (req, res) => {
  const startTime = Date.now();
  const requestId = req.headers['x-request-id'] as string;

  try {
    const { 
      folderId, 
      maxFiles = 50, 
      accessToken, 
      refreshToken,
      mimeTypes = ['text/plain', 'application/vnd.google-apps.document']
    } = req.body;

    if (!accessToken && !refreshToken) {
      res.status(400).json({
        success: false,
        error: {
          message: 'Access token or refresh token is required',
          code: 'MISSING_AUTH_TOKEN'
        },
        metadata: {
          timestamp: new Date().toISOString(),
          requestId
        }
      });
      return;
    }

    // Set credentials for Google Drive service
    if (refreshToken) {
      googleDriveService.setCredentials({
        access_token: accessToken || '',
        refresh_token: refreshToken,
        scope: 'https://www.googleapis.com/auth/drive.readonly',
        token_type: 'Bearer'
      });
    }

    // Validate credentials
    const isValid = await googleDriveService.validateCredentials();
    if (!isValid) {
      res.status(401).json({
        success: false,
        error: {
          message: 'Invalid Google Drive credentials',
          code: 'INVALID_CREDENTIALS'
        },
        metadata: {
          timestamp: new Date().toISOString(),
          requestId
        }
      });
      return;
    }

    console.log(`Starting Google Drive sync - Folder: ${folderId || 'root'}, Max files: ${maxFiles}`);

    // List files from Google Drive
    const files = await googleDriveService.listFiles({
      folderId,
      maxResults: maxFiles,
      mimeTypes
    });

    console.log(`Found ${files.length} files to process`);

    const results = [];
    const errors = [];
    let processedFiles = 0;
    let skippedFiles = 0;
    let totalChunks = 0;
    let totalSize = 0;

    // Process each file
    for (const file of files) {
      try {
        console.log(`Processing file: ${file.name} (${file.id})`);

        // Download file content
        const { content, metadata } = await googleDriveService.downloadFile(file.id);
        
        if (!content || content.trim().length === 0) {
          console.log(`Skipping empty file: ${file.name}`);
          skippedFiles++;
          continue;
        }

        // Process document through MCP server
        const documentId = `gdrive_${file.id}`;
        console.log(`Calling MCP server for document: ${documentId}`);
        console.log(`Content length: ${content.length} characters`);
        console.log(`MIME type: ${file.mimeType}`);
        
        const mcpResponse = await axios.post(`${MCP_SERVER_URL}/tools/document_chunk_and_embed`, {
          documentId,
          content,
          mimeType: file.mimeType
        });

        console.log(`MCP response status: ${mcpResponse.status}`);
        console.log(`MCP response success: ${mcpResponse.data.success}`);

        if (!mcpResponse.data.success) {
          console.error(`MCP processing failed for ${file.name}:`, mcpResponse.data.error);
          throw new Error(mcpResponse.data.error?.message || 'Failed to process document');
        }

        const processResult = mcpResponse.data.data;
        console.log(`Successfully processed ${file.name}: ${processResult.chunks.length} chunks created`);

        results.push({
          fileId: file.id,
          fileName: file.name,
          status: 'processed',
          chunks: processResult.chunks.length,
          size: parseInt(file.size || '0'),
          mimeType: file.mimeType,
          processingTime: processResult.processingTimeMs
        });

        processedFiles++;
        totalChunks += processResult.chunks.length;
        totalSize += parseInt(file.size || '0');

        console.log(`Successfully processed: ${file.name} (${processResult.chunks.length} chunks)`);

      } catch (error) {
        console.error(`Error processing file ${file.name}:`, error);
        
        errors.push({
          fileId: file.id,
          fileName: file.name,
          error: (error as Error).message
        });

        skippedFiles++;
      }
    }

    const processingTime = Date.now() - startTime;
    const successRate = files.length > 0 ? Math.round((processedFiles / files.length) * 100) : 0;

    console.log(`Google Drive sync completed: ${processedFiles}/${files.length} files processed in ${processingTime}ms`);

    res.json({
      success: true,
      data: {
        status: 'completed',
        totalFiles: files.length,
        processedFiles,
        skippedFiles,
        results,
        errors,
        summary: {
          successRate: `${successRate}%`,
          totalChunks,
          totalSize,
          averageProcessingTime: processedFiles > 0 ? Math.round(processingTime / processedFiles) : 0
        },
        processingTime: {
          total: processingTime,
          unit: 'ms'
        }
      },
      metadata: {
        timestamp: new Date().toISOString(),
        requestId,
        googleDrive: {
          folderId: folderId || 'root',
          mimeTypes,
          maxFiles
        }
      }
    });

  } catch (error) {
    console.error('Error syncing Google Drive:', error);
    
    const err = error as any;
    res.status(err.statusCode || 500).json({
      success: false,
      error: {
        message: err.message || 'Failed to sync Google Drive documents',
        code: err.code || 'GOOGLE_DRIVE_SYNC_ERROR',
        details: err.details
      },
      metadata: {
        timestamp: new Date().toISOString(),
        requestId,
        processingTime: {
          total: Date.now() - startTime,
          unit: 'ms'
        }
      }
    });
  }
});

/**
 * GET /api/sync/status
 * Get sync status and history
 */
router.get('/status', async (req, res) => {
  try {
    // TODO: Implement sync status tracking
    // For now, return basic status
    
    res.json({
      success: true,
      data: {
        lastSync: null,
        totalSyncs: 0,
        totalDocuments: 0,
        status: 'ready',
        message: 'Use POST /api/sync/google-drive to start synchronization'
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

/**
 * POST /api/sync/google-drive/folder/:folderId
 * Sync specific Google Drive folder
 */
router.post('/google-drive/folder/:folderId', async (req, res) => {
  const { folderId } = req.params;
  
  // Add folder ID to request body
  req.body.folderId = folderId;
  
  // Duplicate the main sync logic here for simplicity
  const startTime = Date.now();
  const requestId = req.headers['x-request-id'] as string;

  try {
    const { 
      maxFiles = 50, 
      accessToken, 
      refreshToken,
      mimeTypes = ['text/plain', 'application/vnd.google-apps.document']
    } = req.body;

    if (!accessToken && !refreshToken) {
      res.status(400).json({
        success: false,
        error: {
          message: 'Access token or refresh token is required',
          code: 'MISSING_AUTH_TOKEN'
        },
        metadata: {
          timestamp: new Date().toISOString(),
          requestId
        }
      });
      return;
    }

    // Set credentials for Google Drive service
    if (refreshToken) {
      googleDriveService.setCredentials({
        access_token: accessToken || '',
        refresh_token: refreshToken,
        scope: 'https://www.googleapis.com/auth/drive.readonly',
        token_type: 'Bearer'
      });
    }

    // Validate credentials
    const isValid = await googleDriveService.validateCredentials();
    if (!isValid) {
      res.status(401).json({
        success: false,
        error: {
          message: 'Invalid Google Drive credentials',
          code: 'INVALID_CREDENTIALS'
        },
        metadata: {
          timestamp: new Date().toISOString(),
          requestId
        }
      });
      return;
    }

    console.log(`Starting Google Drive folder sync - Folder: ${folderId}, Max files: ${maxFiles}`);

    // List files from specific folder
    const files = await googleDriveService.listFiles({
      folderId,
      maxResults: maxFiles,
      mimeTypes
    });

    console.log(`Found ${files.length} files to process in folder ${folderId}`);

    const results = [];
    const errors = [];
    let processedFiles = 0;
    let skippedFiles = 0;
    let totalChunks = 0;
    let totalSize = 0;

    // Process each file
    for (const file of files) {
      try {
        console.log(`Processing file: ${file.name} (${file.id})`);

        // Download file content
        const { content, metadata } = await googleDriveService.downloadFile(file.id);
        
        if (!content || content.trim().length === 0) {
          console.log(`Skipping empty file: ${file.name}`);
          skippedFiles++;
          continue;
        }

        // Process document through MCP server
        const documentId = `gdrive_${file.id}`;
        const mcpResponse = await axios.post(`${MCP_SERVER_URL}/tools/document_chunk_and_embed`, {
          documentId,
          content,
          mimeType: file.mimeType
        });

        if (!mcpResponse.data.success) {
          throw new Error(mcpResponse.data.error?.message || 'Failed to process document');
        }

        const processResult = mcpResponse.data.data;

        results.push({
          fileId: file.id,
          fileName: file.name,
          status: 'processed',
          chunks: processResult.chunks.length,
          size: parseInt(file.size || '0'),
          mimeType: file.mimeType,
          processingTime: processResult.processingTimeMs
        });

        processedFiles++;
        totalChunks += processResult.chunks.length;
        totalSize += parseInt(file.size || '0');

        console.log(`Successfully processed: ${file.name} (${processResult.chunks.length} chunks)`);

      } catch (error) {
        console.error(`Error processing file ${file.name}:`, error);
        
        errors.push({
          fileId: file.id,
          fileName: file.name,
          error: (error as Error).message
        });

        skippedFiles++;
      }
    }

    const processingTime = Date.now() - startTime;
    const successRate = files.length > 0 ? Math.round((processedFiles / files.length) * 100) : 0;

    console.log(`Google Drive folder sync completed: ${processedFiles}/${files.length} files processed in ${processingTime}ms`);

    res.json({
      success: true,
      data: {
        status: 'completed',
        totalFiles: files.length,
        processedFiles,
        skippedFiles,
        results,
        errors,
        summary: {
          successRate: `${successRate}%`,
          totalChunks,
          totalSize,
          averageProcessingTime: processedFiles > 0 ? Math.round(processingTime / processedFiles) : 0
        },
        processingTime: {
          total: processingTime,
          unit: 'ms'
        }
      },
      metadata: {
        timestamp: new Date().toISOString(),
        requestId,
        googleDrive: {
          folderId,
          mimeTypes,
          maxFiles
        }
      }
    });

  } catch (error) {
    console.error('Error syncing Google Drive folder:', error);
    
    const err = error as any;
    res.status(err.statusCode || 500).json({
      success: false,
      error: {
        message: err.message || 'Failed to sync Google Drive folder',
        code: err.code || 'GOOGLE_DRIVE_SYNC_ERROR',
        details: err.details
      },
      metadata: {
        timestamp: new Date().toISOString(),
        requestId,
        processingTime: {
          total: Date.now() - startTime,
          unit: 'ms'
        }
      }
    });
  }
});

export { router as syncRouter };
