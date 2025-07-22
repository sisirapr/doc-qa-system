import express from 'express';
import cors from 'cors';
import { env } from '../config/environment';
import { documentsRouter } from './routes/documents';
import { chatRouter } from './routes/chat';
import { healthRouter } from './routes/health';
import { syncRouter } from './routes/sync';
import { authRouter } from './routes/auth';
import { errorHandler } from './middleware/error-handler';
import { requestLogger } from './middleware/request-logger';

const app = express();

// Middleware
app.use(cors({
  origin: env.CORS_ORIGIN,
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(requestLogger);

// Routes
app.use('/api/auth', authRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/chat', chatRouter);
app.use('/api/health', healthRouter);
app.use('/api/sync', syncRouter);

// Error handling
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      message: 'Endpoint not found',
      code: 'NOT_FOUND'
    }
  });
});

const PORT = env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Document Q&A API Server running on port ${PORT}`);
  console.log(`📚 Available endpoints:`);
  console.log(`   - GET  /api/health - Health check`);
  console.log(`   - POST /api/auth/google-drive - Google Drive authentication`);
  console.log(`   - GET  /api/documents - List documents`);
  console.log(`   - POST /api/documents/ingest - Ingest documents`);
  console.log(`   - POST /api/chat/query - Ask questions`);
  console.log(`   - POST /api/sync/google-drive - Sync from Google Drive`);
});

export default app;
