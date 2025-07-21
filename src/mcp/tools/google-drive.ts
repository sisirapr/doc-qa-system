import { google, drive_v3 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { env } from '../../config/environment';
import {
  GoogleDriveDownloadFileInput,
  GoogleDriveDownloadFileOutput,
  GoogleDriveListFilesInput,
  GoogleDriveListFilesOutput,
  MCPError
} from '../types/mcp-types';
import {
  CircuitBreaker,
  createError,
  measureExecutionTime,
  validateInput,
  withRetry
} from '../utils/mcp-helpers';

// Create OAuth2 client
const oauth2Client = new OAuth2Client(
  env.GOOGLE_DRIVE_CLIENT_ID,
  env.GOOGLE_DRIVE_CLIENT_SECRET,
  env.GOOGLE_DRIVE_REDIRECT_URI
);

// Circuit breaker for Google Drive API
const circuitBreaker = new CircuitBreaker();

/**
 * Set OAuth2 credentials
 * @param refreshToken Google Drive refresh token
 */
export function setCredentials(refreshToken: string): void {
  oauth2Client.setCredentials({
    refresh_token: refreshToken
  });
}

/**
 * Get Google Drive client
 * @returns Google Drive client
 */
function getDriveClient(): drive_v3.Drive {
  if (!oauth2Client.credentials.refresh_token) {
    throw createError(
      'Google Drive not authenticated',
      'AUTHENTICATION_REQUIRED',
      401
    );
  }
  
  // Use the OAuth2Client directly as auth
  return google.drive({
    version: 'v3',
    auth: oauth2Client as any // Type assertion to bypass type checking
  });
}

/**
 * List files in Google Drive
 * @param input List files input
 * @returns List of files
 */
export async function googleDriveListFiles(
  input: GoogleDriveListFilesInput
): Promise<GoogleDriveListFilesOutput> {
  try {
    return await circuitBreaker.execute(async () => {
      const drive = getDriveClient();
      
      const [result, executionTime] = await measureExecutionTime(async () => {
        return await withRetry(async () => {
          const response = await drive.files.list({
            q: input.folderId ? `'${input.folderId}' in parents and trashed = false` : 'trashed = false',
            pageSize: input.maxResults || 100,
            fields: 'nextPageToken, files(id, name, mimeType, size, createdTime, modifiedTime, webViewLink)',
            orderBy: 'modifiedTime desc',
            ...(input.mimeTypes && input.mimeTypes.length > 0
              ? { q: `mimeType in ('${input.mimeTypes.join("','")}')` }
              : {})
          });
          
          return response.data;
        });
      });
      
      console.log(`Google Drive list files completed in ${executionTime}ms`);
      
      return {
        files: (result.files || []).map(file => ({
          id: file.id || '',
          name: file.name || '',
          mimeType: file.mimeType || '',
          size: parseInt(file.size || '0', 10),
          createdTime: file.createdTime || new Date().toISOString(),
          modifiedTime: file.modifiedTime || new Date().toISOString(),
          webViewLink: file.webViewLink || ''
        })),
        // Only include nextPageToken if it exists
        ...(result.nextPageToken ? { nextPageToken: result.nextPageToken } : {})
      };
    });
  } catch (error) {
    console.error('Error listing Google Drive files:', error);
    
    if (error instanceof MCPError) {
      throw error;
    }
    
    const statusCode = (error as any)?.response?.status || 500;
    const errorMessage = (error as any)?.response?.data?.error?.message || (error as Error).message;
    
    if (statusCode === 401 || statusCode === 403) {
      throw createError(
        'Authentication failed with Google Drive',
        'AUTHENTICATION_FAILED',
        401,
        { originalError: errorMessage }
      );
    }
    
    if (statusCode === 429) {
      throw createError(
        'Google Drive API rate limit exceeded',
        'RATE_LIMITED',
        429,
        { originalError: errorMessage }
      );
    }
    
    throw createError(
      'Failed to list Google Drive files',
      'GOOGLE_DRIVE_ERROR',
      statusCode,
      { originalError: errorMessage }
    );
  }
}

/**
 * Download file from Google Drive
 * @param input Download file input
 * @returns Downloaded file
 */
export async function googleDriveDownloadFile(
  input: GoogleDriveDownloadFileInput
): Promise<GoogleDriveDownloadFileOutput> {
  validateInput(input, ['fileId']);
  
  try {
    return await circuitBreaker.execute(async () => {
      const drive = getDriveClient();
      
      // Get file metadata
      const [fileMetadata, metadataTime] = await measureExecutionTime(async () => {
        return await withRetry(async () => {
          const response = await drive.files.get({
            fileId: input.fileId,
            fields: 'id, name, mimeType, size, createdTime, modifiedTime, webViewLink'
          });
          
          return response.data;
        });
      });
      
      console.log(`Google Drive file metadata fetched in ${metadataTime}ms`);
      
      // Download file content
      const [fileContent, downloadTime] = await measureExecutionTime(async () => {
        return await withRetry(async () => {
          const response = await drive.files.get({
            fileId: input.fileId,
            alt: 'media',
            ...(input.mimeType ? { mimeType: input.mimeType } : {})
          }, {
            responseType: 'arraybuffer'
          });
          
          return Buffer.from(response.data as ArrayBuffer);
        });
      });
      
      console.log(`Google Drive file downloaded in ${downloadTime}ms`);
      
      return {
        fileId: fileMetadata.id || input.fileId,
        fileName: fileMetadata.name || 'unknown',
        mimeType: fileMetadata.mimeType || input.mimeType || 'application/octet-stream',
        size: parseInt(fileMetadata.size || '0', 10),
        content: fileContent,
        metadata: {
          createdTime: fileMetadata.createdTime || new Date().toISOString(),
          modifiedTime: fileMetadata.modifiedTime || new Date().toISOString(),
          webViewLink: fileMetadata.webViewLink || ''
        }
      };
    });
  } catch (error) {
    console.error('Error downloading Google Drive file:', error);
    
    if (error instanceof MCPError) {
      throw error;
    }
    
    const statusCode = (error as any)?.response?.status || 500;
    const errorMessage = (error as any)?.response?.data?.error?.message || (error as Error).message;
    
    if (statusCode === 401 || statusCode === 403) {
      throw createError(
        'Authentication failed with Google Drive',
        'AUTHENTICATION_FAILED',
        401,
        { originalError: errorMessage }
      );
    }
    
    if (statusCode === 404) {
      throw createError(
        `File not found: ${input.fileId}`,
        'FILE_NOT_FOUND',
        404,
        { originalError: errorMessage }
      );
    }
    
    if (statusCode === 429) {
      throw createError(
        'Google Drive API rate limit exceeded',
        'RATE_LIMITED',
        429,
        { originalError: errorMessage }
      );
    }
    
    throw createError(
      'Failed to download Google Drive file',
      'GOOGLE_DRIVE_ERROR',
      statusCode,
      { originalError: errorMessage }
    );
  }
}

/**
 * Generate Google Drive authentication URL
 * @returns Authentication URL
 */
export function generateAuthUrl(): string {
  const scopes = [
    'https://www.googleapis.com/auth/drive.readonly'
  ];
  
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent'
  });
}

/**
 * Exchange authorization code for tokens
 * @param code Authorization code
 * @returns Tokens
 */
export async function getTokensFromCode(code: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}> {
  try {
    const { tokens } = await oauth2Client.getToken(code);
    
    if (!tokens.refresh_token) {
      throw createError(
        'No refresh token received',
        'AUTHENTICATION_FAILED',
        401
      );
    }
    
    // Set credentials for future use
    oauth2Client.setCredentials(tokens);
    
    return {
      accessToken: tokens.access_token || '',
      refreshToken: tokens.refresh_token,
      expiresAt: tokens.expiry_date || Date.now() + 3600 * 1000
    };
  } catch (error) {
    console.error('Error getting tokens:', error);
    
    throw createError(
      'Failed to authenticate with Google Drive',
      'AUTHENTICATION_FAILED',
      401,
      { originalError: (error as Error).message }
    );
  }
}
