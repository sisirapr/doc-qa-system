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
 * POST /api/auth/google-drive/callback
 * Exchange authorization code for tokens
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
        message: 'Google Drive authentication successful',
        expiresAt: new Date(tokens.expiresAt).toISOString(),
        hasRefreshToken: !!tokens.refreshToken
      },
      metadata: {
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id']
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
