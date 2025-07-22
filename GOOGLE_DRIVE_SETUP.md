# Google Drive Integration Setup Guide

This guide will help you set up Google Drive integration for the Document Q&A System.

## Prerequisites

- Google Cloud Console account
- Document Q&A System running locally
- Basic understanding of OAuth 2.0

## Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Enter project name: `doc-qa-system` (or your preferred name)
4. Click "Create"

## Step 2: Enable Google Drive API

1. In the Google Cloud Console, go to "APIs & Services" → "Library"
2. Search for "Google Drive API"
3. Click on "Google Drive API" and click "Enable"

## Step 3: Create OAuth 2.0 Credentials

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. If prompted, configure the OAuth consent screen:
   - Choose "External" user type
   - Fill in required fields:
     - App name: `Document Q&A System`
     - User support email: Your email
     - Developer contact information: Your email
   - Add scopes:
     - `https://www.googleapis.com/auth/drive.readonly`
     - `https://www.googleapis.com/auth/drive.metadata.readonly`
   - Add test users (your email)

4. Create OAuth client ID:
   - Application type: "Web application"
   - Name: `Doc Q&A Web Client`
   - Authorized redirect URIs:
     - `http://localhost:3000/auth/google-drive/callback`
     - `http://localhost:3000/api/auth/google-drive/callback`

5. Copy the Client ID and Client Secret

## Step 4: Configure Environment Variables

1. Copy `.env.example` to `.env` if you haven't already:
   ```bash
   cp .env.example .env
   ```

2. Update the Google Drive configuration in `.env`:
   ```env
   # Google Drive API
   GOOGLE_DRIVE_CLIENT_ID=your_actual_client_id_here
   GOOGLE_DRIVE_CLIENT_SECRET=your_actual_client_secret_here
   GOOGLE_DRIVE_REDIRECT_URI=http://localhost:3000/auth/google-drive/callback
   ```

## Step 5: Test the Integration

1. Start the servers:
   ```bash
   # Terminal 1: Start Qdrant
   docker-compose up qdrant

   # Terminal 2: Start MCP Server
   npm run mcp:dev

   # Terminal 3: Start API Server
   npm run api:dev
   ```

2. Test authentication:
   ```bash
   curl -X GET http://localhost:3000/api/auth/google-drive
   ```

   This should return an authentication URL.

3. Visit the authentication URL in your browser
4. Grant permissions to your Google Drive
5. Copy the authorization code from the callback URL
6. Exchange the code for tokens:
   ```bash
   curl -X POST http://localhost:3000/api/auth/google-drive/callback \
     -H "Content-Type: application/json" \
     -d '{"code": "your_authorization_code_here"}'
   ```

## Step 6: Sync Documents from Google Drive

Once authenticated, you can sync documents:

```bash
curl -X POST http://localhost:3000/api/sync/google-drive \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "your_refresh_token_from_step_5",
    "maxFiles": 10,
    "mimeTypes": ["text/plain", "application/vnd.google-apps.document"]
  }'
```

## API Endpoints

### Authentication

#### Get Authentication URL
```http
GET /api/auth/google-drive
```

**Response:**
```json
{
  "success": true,
  "data": {
    "authUrl": "https://accounts.google.com/oauth2/auth?...",
    "instructions": [
      "1. Visit the provided URL",
      "2. Grant permissions to access your Google Drive",
      "3. Copy the authorization code from the callback",
      "4. Use the code with POST /api/auth/google-drive/callback"
    ]
  }
}
```

#### Exchange Authorization Code
```http
POST /api/auth/google-drive/callback
Content-Type: application/json

{
  "code": "authorization_code_from_google"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Google Drive authentication successful",
    "expiresAt": "2025-07-22T12:00:00.000Z",
    "hasRefreshToken": true
  }
}
```

### Document Synchronization

#### Sync All Documents
```http
POST /api/sync/google-drive
Content-Type: application/json

{
  "refreshToken": "your_refresh_token",
  "maxFiles": 50,
  "mimeTypes": ["text/plain", "application/vnd.google-apps.document"]
}
```

#### Sync Specific Folder
```http
POST /api/sync/google-drive/folder/{folderId}
Content-Type: application/json

{
  "refreshToken": "your_refresh_token",
  "maxFiles": 20
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "completed",
    "totalFiles": 5,
    "processedFiles": 4,
    "skippedFiles": 1,
    "results": [
      {
        "fileId": "1abc123...",
        "fileName": "document.txt",
        "status": "processed",
        "chunks": 3,
        "size": 1024,
        "mimeType": "text/plain",
        "processingTime": 1200
      }
    ],
    "errors": [
      {
        "fileId": "1def456...",
        "fileName": "empty.txt",
        "error": "Empty file content"
      }
    ],
    "summary": {
      "successRate": "80%",
      "totalChunks": 12,
      "totalSize": 4096,
      "averageProcessingTime": 1100
    }
  }
}
```

## Supported File Types

Currently supported:
- **Text files** (`.txt`): `text/plain`
- **Google Docs**: `application/vnd.google-apps.document`

Coming soon:
- **PDF files**: `application/pdf`
- **Word documents**: `application/vnd.openxmlformats-officedocument.wordprocessingml.document`

## Troubleshooting

### Common Issues

#### 1. "Invalid credentials" error
- Verify your Client ID and Client Secret are correct
- Check that the redirect URI matches exactly
- Ensure the Google Drive API is enabled

#### 2. "Refresh token not received"
- Make sure you're using `prompt: 'consent'` in the OAuth flow
- Try revoking and re-authorizing the application

#### 3. "File not found" errors
- Check that the files exist and are accessible
- Verify the user has read permissions for the files
- Ensure files are not in the trash

#### 4. Rate limiting
- The system includes automatic retry with exponential backoff
- For large syncs, consider reducing `maxFiles` parameter

### Debug Mode

Enable debug logging by setting:
```env
LOG_LEVEL=debug
```

This will show detailed information about:
- OAuth token exchanges
- Google Drive API calls
- Document processing steps
- Vector storage operations

## Security Considerations

1. **Store refresh tokens securely** - Never commit them to version control
2. **Use HTTPS in production** - Update redirect URIs for production deployment
3. **Limit OAuth scopes** - Only request necessary permissions
4. **Implement token rotation** - Refresh tokens periodically
5. **Monitor API usage** - Keep track of quota limits

## Production Deployment

For production deployment:

1. Update OAuth redirect URIs to use your production domain
2. Set up proper secret management (AWS Secrets Manager, etc.)
3. Configure rate limiting and monitoring
4. Set up proper logging and error tracking
5. Consider implementing webhook notifications for file changes

## Next Steps

After setting up Google Drive integration:

1. **Frontend Development** - Create a user interface for authentication and sync
2. **Automated Sync** - Set up scheduled synchronization
3. **File Monitoring** - Implement real-time file change detection
4. **Advanced Features** - Add support for more file types and batch operations

## Support

If you encounter issues:

1. Check the server logs for detailed error messages
2. Verify all environment variables are set correctly
3. Test with a simple text file first
4. Ensure your Google Cloud project has the necessary APIs enabled

For additional help, refer to:
- [Google Drive API Documentation](https://developers.google.com/drive/api)
- [OAuth 2.0 for Web Server Applications](https://developers.google.com/identity/protocols/oauth2/web-server)
