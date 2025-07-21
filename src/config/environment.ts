import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  // Database
  QDRANT_URL: z.string().url(),
  QDRANT_API_KEY: z.string().optional(),

  // Google Drive
  GOOGLE_DRIVE_CLIENT_ID: z.string(),
  GOOGLE_DRIVE_CLIENT_SECRET: z.string(),
  GOOGLE_DRIVE_REDIRECT_URI: z.string().url(),

  // LLM Provider
  OPENAI_API_KEY: z.string(),
  LLM_PROVIDER: z.enum(['openai', 'anthropic']).default('openai'),
  EMBEDDING_MODEL: z.string().default('text-embedding-3-small'),

  // Application
  PORT: z.string().transform(Number).default('3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),

  // MCP Server
  MCP_SERVER_PORT: z.string().transform(Number).default('3001'),
  MCP_SERVER_HOST: z.string().default('localhost'),

  // Security
  JWT_SECRET: z.string(),
  CORS_ORIGIN: z.string().url().default('http://localhost:3000'),

  // File Processing
  MAX_FILE_SIZE: z.string().transform(Number).default('10485760'),
  CHUNK_SIZE: z.string().transform(Number).default('1000'),
  CHUNK_OVERLAP: z.string().transform(Number).default('200'),
});

export type Environment = z.infer<typeof envSchema>;

let env: Environment;

try {
  env = envSchema.parse(process.env);
} catch (error) {
  console.error('❌ Invalid environment variables:', error);
  process.exit(1);
}

export { env };

export const isDevelopment = env.NODE_ENV === 'development';
export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
