import { Router } from 'express';
import { generateAuthUrl, getTokensFromCode, setOAuth2Credentials } from '../../mcp/tools/google-drive';

const router = Router();

/**
 * GET /api/auth/google-drive
 * Get Google Drive authentication URL
 */
router.get('/google-drive', async (req, res) => {
  try {
    const authUrl = generateAuthUrl();
    
    res.json({
      success: true,
      data: {
        authUrl,
        instructions: [
          '1. Visit the provided URL',
          '2. Grant permissions to access your Google Drive',
          '3. Copy the authorization code from the callback',
          '4. Use the code with POST /api/auth/google-drive/callback'
        ]
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
        message: 'Failed to generate authentication URL',
        code: 'AUTH_URL_ERROR',
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
 * GET /api/auth/google-drive/callback
 * Handle OAuth callback from Google
 */
router.get('/google-drive/callback', async (req, res) => {
  try {
    const { code, error } = req.query;
    
    if (error) {
      // Handle OAuth error
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Google Drive Authentication</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
            .error { color: #d32f2f; background: #ffebee; padding: 15px; border-radius: 4px; }
            .code { background: #f5f5f5; padding: 10px; border-radius: 4px; font-family: monospace; }
          </style>
        </head>
        <body>
          <h1>Authentication Failed</h1>
          <div class="error">
            <strong>Error:</strong> ${error}<br>
            <strong>Description:</strong> ${req.query.error_description || 'Unknown error'}
          </div>
          <p>Please close this window and try again.</p>
        </body>
        </html>
      `);
      return;
    }
    
    if (!code) {
      res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Google Drive Authentication</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
            .error { color: #d32f2f; background: #ffebee; padding: 15px; border-radius: 4px; }
          </style>
        </head>
        <body>
          <h1>Authentication Failed</h1>
          <div class="error">No authorization code received from Google.</div>
          <p>Please close this window and try again.</p>
        </body>
        </html>
      `);
      return;
    }

    const tokens = await getTokensFromCode(code as string);
    
    // Return success page that automatically sends the refresh token to the parent window
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Google Drive Authentication</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; text-align: center; }
          .success { color: #2e7d32; background: #e8f5e9; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
          .spinner { border: 4px solid #f3f3f3; border-top: 4px solid #1976d2; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 20px auto; }
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        </style>
      </head>
      <body>
        <h1>Google Drive Authentication Successful!</h1>
        <div class="success">
          ✅ Successfully authenticated with Google Drive
        </div>
        
        <div class="spinner"></div>
        <p>Completing authentication...</p>
        <p><small>This window will close automatically.</small></p>
        
        <script>
          // Send the refresh token to the parent window
          if (window.opener) {
            window.opener.postMessage({
              type: 'GOOGLE_DRIVE_AUTH_SUCCESS',
              refreshToken: '${tokens.refreshToken}',
              expiresAt: ${tokens.expiresAt}
            }, '*');
            
            // Close the popup after a short delay
            setTimeout(() => {
              window.close();
            }, 2000);
          } else {
            // Fallback if no opener (direct navigation)
            document.body.innerHTML = \`
              <h1>Authentication Complete!</h1>
              <div class="success">✅ You can close this window and return to the application.</div>
            \`;
          }
        </script>
      </body>
      </html>
    `);
  } catch (error) {
    const err = error as any;
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Google Drive Authentication</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
          .error { color: #d32f2f; background: #ffebee; padding: 15px; border-radius: 4px; }
        </style>
      </head>
      <body>
        <h1>Authentication Failed</h1>
        <div class="error">
          <strong>Error:</strong> ${err.message || 'Authentication failed'}<br>
          <strong>Code:</strong> ${err.code || 'AUTH_ERROR'}
        </div>
        <p>Please close this window and try again.</p>
      </body>
      </html>
    `);
  }
});

/**
 * POST /api/auth/google-drive/callback
 * Exchange authorization code for tokens (for API use)
 */
router.post('/google-drive/callback', async (req, res) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      res.status(400).json({
        success: false,
        error: {
          message: 'Authorization code is required',
          code: 'MISSING_AUTH_CODE'
        },
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id']
        }
      });
      return;
    }

    const tokens = await getTokensFromCode(code);
    
    res.json({
      success: true,
      data: {
        message: 'Successfully authenticated with Google Drive',
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt
      },
      metadata: {
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'],
        tool: 'google_drive_auth'
      }
    });
  } catch (error) {
    const err = error as any;
    res.status(err.statusCode || 500).json({
      success: false,
      error: {
        message: err.message || 'Authentication failed',
        code: err.code || 'AUTH_ERROR',
        details: err.details
      },
      metadata: {
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id']
      }
    });
  }
});

/**
 * GET /api/auth/status
 * Check authentication status
 */
router.get('/status', async (req, res) => {
  try {
    // TODO: Implement proper authentication status check
    // For now, we'll return a basic status
    
    res.json({
      success: true,
      data: {
        googleDrive: {
          authenticated: false, // TODO: Check actual auth status
          message: 'Use GET /api/auth/google-drive to authenticate'
        }
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
        message: 'Failed to check authentication status',
        code: 'AUTH_STATUS_ERROR',
        details: err.message
      },
      metadata: {
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id']
      }
    });
  }
});

export { router as authRouter };
