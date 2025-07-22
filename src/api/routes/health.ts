import { Router } from 'express';
import { getModelAvailability } from '../../services/ai';

const router = Router();

/**
 * GET /api/health
 * Health check endpoint
 */
router.get('/', async (req, res) => {
  try {
    const modelAvailability = getModelAvailability();
    
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      services: {
        api: 'healthy',
        ai: {
          status: modelAvailability.languageModel && modelAvailability.embeddingModel ? 'healthy' : 'degraded',
          details: modelAvailability
        },
        database: {
          status: 'healthy', // TODO: Add actual Qdrant health check
          type: 'qdrant'
        }
      },
      uptime: process.uptime(),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        unit: 'MB'
      }
    };

    res.json({
      success: true,
      data: health,
      metadata: {
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id']
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        message: 'Health check failed',
        code: 'HEALTH_CHECK_ERROR'
      },
      metadata: {
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id']
      }
    });
  }
});

export { router as healthRouter };
