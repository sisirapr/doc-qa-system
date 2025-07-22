import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { env } from '../config/environment';
import { createError } from '../mcp/utils/mcp-helpers';

export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  createdTime: string;
  modifiedTime: string;
  parents?: string[];
  webViewLink?: string;
}

export interface GoogleDriveAuth {
  access_token: string;
  refresh_token?: string;
  scope: string;
  token_type: string;
  expiry_date?: number;
}

export class GoogleDriveService {
  private oauth2Client: OAuth2Client;
  private drive: any;

  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      env.GOOGLE_DRIVE_CLIENT_ID,
      env.GOOGLE_DRIVE_CLIENT_SECRET,
      env.GOOGLE_DRIVE_REDIRECT_URI
    );

    this.drive = google.drive({ version: 'v3', auth: this.oauth2Client });
  }

  /**
   * Generate OAuth2 authorization URL
   */
  getAuthUrl(): string {
    const scopes = [
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/drive.metadata.readonly'
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent'
    });
  }

  /**
   * Exchange authorization code for tokens
   */
  async getTokens(code: string): Promise<GoogleDriveAuth> {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      this.oauth2Client.setCredentials(tokens);
      
      return {
        access_token: tokens.access_token!,
        refresh_token: tokens.refresh_token,
        scope: tokens.scope!,
        token_type: tokens.token_type!,
        expiry_date: tokens.expiry_date
      };
    } catch (error) {
      console.error('Error getting tokens:', error);
      throw createError(
        'Failed to exchange authorization code for tokens',
        'GOOGLE_DRIVE_AUTH_ERROR',
        400,
        { originalError: (error as Error).message }
      );
    }
  }

  /**
   * Set authentication credentials
   */
  setCredentials(auth: GoogleDriveAuth): void {
    this.oauth2Client.setCredentials({
      access_token: auth.access_token,
      refresh_token: auth.refresh_token,
      scope: auth.scope,
      token_type: auth.token_type,
      expiry_date: auth.expiry_date
    });
  }

  /**
   * List files in Google Drive
   */
  async listFiles(options: {
    folderId?: string;
    maxResults?: number;
    mimeTypes?: string[];
    query?: string;
  } = {}): Promise<GoogleDriveFile[]> {
    try {
      const {
        folderId,
        maxResults = 100,
        mimeTypes = ['text/plain', 'application/pdf', 'application/vnd.google-apps.document'],
        query
      } = options;

      let q = '';
      
      // Build query
      if (folderId) {
        q += `'${folderId}' in parents`;
      }
      
      if (mimeTypes.length > 0) {
        const mimeQuery = mimeTypes.map(type => `mimeType='${type}'`).join(' or ');
        q += q ? ` and (${mimeQuery})` : `(${mimeQuery})`;
      }
      
      if (query) {
        q += q ? ` and name contains '${query}'` : `name contains '${query}'`;
      }

      // Add trashed filter
      q += q ? ' and trashed=false' : 'trashed=false';

      console.log('Google Drive query:', q);

      const response = await this.drive.files.list({
        q,
        pageSize: maxResults,
        fields: 'files(id,name,mimeType,size,createdTime,modifiedTime,parents,webViewLink)',
        orderBy: 'modifiedTime desc'
      });

      return response.data.files.map((file: any) => ({
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        size: file.size,
        createdTime: file.createdTime,
        modifiedTime: file.modifiedTime,
        parents: file.parents,
        webViewLink: file.webViewLink
      }));
    } catch (error) {
      console.error('Error listing files:', error);
      throw createError(
        'Failed to list Google Drive files',
        'GOOGLE_DRIVE_LIST_ERROR',
        500,
        { originalError: (error as Error).message }
      );
    }
  }

  /**
   * Download file content from Google Drive
   */
  async downloadFile(fileId: string): Promise<{ content: string; metadata: GoogleDriveFile }> {
    try {
      // Get file metadata
      const metadataResponse = await this.drive.files.get({
        fileId,
        fields: 'id,name,mimeType,size,createdTime,modifiedTime,parents,webViewLink'
      });

      const metadata: GoogleDriveFile = {
        id: metadataResponse.data.id,
        name: metadataResponse.data.name,
        mimeType: metadataResponse.data.mimeType,
        size: metadataResponse.data.size,
        createdTime: metadataResponse.data.createdTime,
        modifiedTime: metadataResponse.data.modifiedTime,
        parents: metadataResponse.data.parents,
        webViewLink: metadataResponse.data.webViewLink
      };

      let content: string;

      // Handle different file types
      if (metadata.mimeType === 'application/vnd.google-apps.document') {
        // Google Docs - export as plain text
        const response = await this.drive.files.export({
          fileId,
          mimeType: 'text/plain'
        });
        content = response.data;
      } else if (metadata.mimeType === 'text/plain') {
        // Plain text files
        const response = await this.drive.files.get({
          fileId,
          alt: 'media'
        });
        content = response.data;
      } else if (metadata.mimeType === 'application/pdf') {
        // PDF files - would need additional processing
        throw createError(
          'PDF file processing not yet implemented',
          'UNSUPPORTED_FILE_TYPE',
          400,
          { mimeType: metadata.mimeType }
        );
      } else {
        throw createError(
          `Unsupported file type: ${metadata.mimeType}`,
          'UNSUPPORTED_FILE_TYPE',
          400,
          { mimeType: metadata.mimeType }
        );
      }

      return { content, metadata };
    } catch (error) {
      console.error('Error downloading file:', error);
      
      if (error.code === 'UNSUPPORTED_FILE_TYPE') {
        throw error;
      }
      
      throw createError(
        'Failed to download file from Google Drive',
        'GOOGLE_DRIVE_DOWNLOAD_ERROR',
        500,
        { originalError: (error as Error).message, fileId }
      );
    }
  }

  /**
   * Get folder information
   */
  async getFolderInfo(folderId: string): Promise<GoogleDriveFile> {
    try {
      const response = await this.drive.files.get({
        fileId: folderId,
        fields: 'id,name,mimeType,createdTime,modifiedTime,parents,webViewLink'
      });

      return {
        id: response.data.id,
        name: response.data.name,
        mimeType: response.data.mimeType,
        createdTime: response.data.createdTime,
        modifiedTime: response.data.modifiedTime,
        parents: response.data.parents,
        webViewLink: response.data.webViewLink
      };
    } catch (error) {
      console.error('Error getting folder info:', error);
      throw createError(
        'Failed to get folder information',
        'GOOGLE_DRIVE_FOLDER_ERROR',
        500,
        { originalError: (error as Error).message, folderId }
      );
    }
  }

  /**
   * Search files by content or name
   */
  async searchFiles(searchQuery: string, options: {
    maxResults?: number;
    mimeTypes?: string[];
  } = {}): Promise<GoogleDriveFile[]> {
    const { maxResults = 50, mimeTypes } = options;
    
    return this.listFiles({
      query: searchQuery,
      maxResults,
      mimeTypes
    });
  }

  /**
   * Check if credentials are valid
   */
  async validateCredentials(): Promise<boolean> {
    try {
      await this.drive.about.get({ fields: 'user' });
      return true;
    } catch (error) {
      console.error('Invalid credentials:', error);
      return false;
    }
  }

  /**
   * Refresh access token if needed
   */
  async refreshTokenIfNeeded(): Promise<void> {
    try {
      await this.oauth2Client.getAccessToken();
    } catch (error) {
      console.error('Error refreshing token:', error);
      throw createError(
        'Failed to refresh access token',
        'GOOGLE_DRIVE_TOKEN_REFRESH_ERROR',
        401,
        { originalError: (error as Error).message }
      );
    }
  }
}

// Export singleton instance
export const googleDriveService = new GoogleDriveService();
