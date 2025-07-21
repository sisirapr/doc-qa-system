Help me implement below plan.
- Make sure to follow these while developing: Do not assume while doing anything new ask my permission.
- Do not write unit tests
- Do not exceed a file size beyond 350 lines
- Do not complicate this project, keep it simple and robust
- Keep development progress in a md file.
- At each step completion notify to git commit 

# Plan:

# Document Q&A System - Implementation Plan

## 1. System Architecture Overview

### High-Level Architecture
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │   API Layer      │    │   MCP Server    │
│   (Next.js)     │◄──►│   (Express/      │◄──►│   (Tools &      │
│                 │    │    Fastify)      │    │    Functions)   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │   Core Services  │
                       │   - Document     │
                       │   - Vector       │
                       │   - LLM          │
                       └──────────────────┘
                                │
                    ┌───────────┼───────────┐
                    ▼           ▼           ▼
            ┌─────────────┐ ┌─────────┐ ┌─────────────┐
            │ Google      │ │ Qdrant  │ │ AI Provider │
            │ Drive API   │ │ Vector  │ │ (OpenAI/    │
            │             │ │ DB      │ │  Anthropic) │
            └─────────────┘ └─────────┘ └─────────────┘
```

### Core Components

#### 1. **MCP Server Layer**
- **Purpose**: Organize tools and functions following MCP patterns
- **Components**:
  - Document ingestion tools
  - Vector search tools  
  - Google Drive integration tools
  - Document processing utilities

#### 2. **API Layer**
- **Framework**: Express.js with TypeScript
- **Endpoints**:
  - `/api/documents` - Document management
  - `/api/chat` - Q&A interactions
  - `/api/health` - System health checks
  - `/api/sync` - Google Drive synchronization

#### 3. **Core Services**
- **DocumentService**: Handle document CRUD operations
- **VectorService**: Manage embeddings and similarity search
- **LLMService**: Handle AI interactions via Vercel AI SDK
- **GoogleDriveService**: Manage Google Drive integration

#### 4. **Data Layer**
- **Qdrant**: Vector database for embeddings
- **Local Storage**: Temporary file storage
- **Configuration**: Environment-based settings

## 2. Detailed Component Specifications

### 2.1 MCP Server Implementation

```typescript
// Structure for MCP Server
src/mcp/
├── server.ts              # Main MCP server
├── tools/
│   ├── google-drive.ts    # Google Drive operations
│   ├── document-processor.ts # Document processing
│   ├── vector-search.ts   # Vector operations
│   └── index.ts          # Tool registry
├── types/
│   └── mcp-types.ts      # MCP-specific types
└── utils/
    └── mcp-helpers.ts    # MCP utility functions
```

**MCP Tools to Implement**:
1. `google_drive_list_files` - List files in Google Drive
2. `google_drive_download_file` - Download specific file
3. `document_chunk_and_embed` - Process and embed document
4. `vector_similarity_search` - Search similar chunks
5. `document_qa_query` - Answer questions about documents

### 2.2 Document Processing Pipeline

```typescript
interface DocumentProcessingPipeline {
  1. fetch: (fileId: string) => Promise<Buffer>
  2. validate: (content: Buffer) => Promise<boolean>
  3. extract: (content: Buffer) => Promise<string>
  4. chunk: (text: string) => Promise<DocumentChunk[]>
  5. embed: (chunks: DocumentChunk[]) => Promise<EmbeddedChunk[]>
  6. store: (embeddings: EmbeddedChunk[]) => Promise<void>
}
```

**Chunking Strategy**:
- **Method**: Recursive character text splitting
- **Chunk Size**: 1000 characters
- **Overlap**: 200 characters
- **Preserve**: Sentence boundaries

### 2.3 Vector Database Schema

```typescript
// Qdrant Collection Structure
interface DocumentVector {
  id: string;                    // Unique chunk ID
  vector: number[];              // Embedding vector
  payload: {
    document_id: string;         // Source document ID
    document_name: string;       // Original filename
    chunk_index: number;         // Chunk position
    content: string;            // Original text content
    metadata: {
      file_size: number;
      created_at: string;
      updated_at: string;
      google_drive_id: string;
      mime_type: string;
    };
  };
}
```

## 3. Error Handling & Resilience

### 3.1 Retry Mechanisms

```typescript
// Universal retry configuration
interface RetryConfig {
  maxAttempts: 3;
  baseDelay: 1000;        // 1 second
  maxDelay: 10000;        // 10 seconds
  backoffMultiplier: 2;   // Exponential backoff
  retryableErrors: [
    'RATE_LIMITED',
    'NETWORK_ERROR', 
    'TIMEOUT_ERROR',
    'TEMPORARY_FAILURE'
  ];
}
```

**Retry Implementation Areas**:
1. **Google Drive API calls** - Handle rate limits and network issues
2. **Embedding generation** - Retry on API failures
3. **Vector database operations** - Handle connection issues
4. **LLM API calls** - Manage rate limits and timeouts

### 3.2 Circuit Breaker Pattern

```typescript
interface CircuitBreakerConfig {
  failureThreshold: 5;      // Failures before opening
  recoveryTimeout: 30000;   // 30 seconds
  monitoringWindow: 60000;  // 1 minute
}
```

### 3.3 Error Categories & Handling

#### **Critical Errors** (System-level failures)
- Database connection failures
- Authentication errors
- Configuration issues
- **Action**: Fail fast, log extensively, notify operators

#### **Transient Errors** (Temporary issues)
- Network timeouts
- Rate limiting
- Temporary API unavailability
- **Action**: Retry with exponential backoff

#### **Business Logic Errors** (User-correctable)
- Invalid file formats
- Empty documents
- Unsupported file types
- **Action**: Return user-friendly error messages

## 4. Edge Cases & Handling

### 4.1 Document Processing Edge Cases

| Edge Case | Detection | Handling Strategy |
|-----------|-----------|-------------------|
| **Empty Documents** | File size = 0 or content.trim() = '' | Skip processing, log warning |
| **Corrupted Files** | Parsing errors, invalid encoding | Mark as failed, retry once |
| **Large Files (>10MB)** | File size check | Stream processing, chunked uploads |
| **Unsupported Formats** | MIME type validation | Skip with clear error message |
| **Special Characters** | Unicode validation | UTF-8 normalization |
| **Binary Files** | Content type analysis | Extract text if possible, skip otherwise |

### 4.2 Google Drive API Edge Cases

| Edge Case | Detection | Handling Strategy |
|-----------|-----------|-------------------|
| **Rate Limiting** | HTTP 429 response | Exponential backoff, respect Retry-After |
| **Quota Exceeded** | Quota error responses | Queue requests, process in batches |
| **File Permissions** | 403 Forbidden errors | Skip file, log permission issue |
| **Deleted Files** | 404 Not Found | Remove from local index |
| **Large Folders** | High file counts | Paginated processing |

### 4.3 Vector Database Edge Cases

| Edge Case | Detection | Handling Strategy |
|-----------|-----------|-------------------|
| **Connection Loss** | Network errors | Reconnect with circuit breaker |
| **Storage Full** | Disk space errors | Implement cleanup policies |
| **Index Corruption** | Search errors | Rebuild index from source |
| **Duplicate Embeddings** | Hash collision detection | Update existing records |

### 4.4 LLM API Edge Cases

| Edge Case | Detection | Handling Strategy |
|-----------|-----------|-------------------|
| **Context Length Exceeded** | Token count validation | Truncate context intelligently |
| **Rate Limiting** | 429 responses | Queue with priority management |
| **Invalid Responses** | Response validation | Request regeneration |
| **Service Downtime** | Connection failures | Fallback to cached responses |

## 5. Clean Code Architecture

### 5.1 Project Structure

```
doc-qa-system/
├── src/
│   ├── api/                    # API routes and controllers
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── routes/
│   │   └── validators/
│   ├── core/                   # Core business logic
│   │   ├── services/
│   │   ├── repositories/
│   │   ├── entities/
│   │   └── interfaces/
│   ├── infrastructure/         # External integrations
│   │   ├── google-drive/
│   │   ├── qdrant/
│   │   ├── llm/
│   │   └── embedding/
│   ├── mcp/                    # MCP server implementation
│   │   ├── server.ts
│   │   ├── tools/
│   │   └── types/
│   ├── utils/                  # Shared utilities
│   │   ├── logger.ts
│   │   ├── retry.ts
│   │   ├── validation.ts
│   │   └── errors.ts
│   ├── config/                 # Configuration
│   │   ├── database.ts
│   │   ├── api.ts
│   │   └── environment.ts
│   └── types/                  # TypeScript definitions
├── frontend/                   # Next.js frontend
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   ├── hooks/
│   │   └── utils/
├── tests/                      # Test suites
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── docs/                       # Documentation
├── scripts/                    # Setup and utility scripts
└── docker/                     # Docker configurations
```

### 5.2 Design Principles

#### **SOLID Principles Implementation**

1. **Single Responsibility**
   - Each service handles one concern
   - Controllers only handle HTTP concerns
   - Services contain business logic

2. **Open/Closed Principle**
   - Plugin architecture for embeddings
   - Strategy pattern for document processors
   - Interface-based integrations

3. **Liskov Substitution**
   - All LLM providers implement same interface
   - Vector database abstraction layer
   - Document processor interfaces

4. **Interface Segregation**
   - Specific interfaces for each integration
   - Minimal required methods
   - Optional capabilities as separate interfaces

5. **Dependency Inversion**
   - Dependency injection container
   - Interface-based dependencies
   - Configuration-driven implementations

#### **Clean Architecture Layers**

```typescript
// Domain Layer (Core Business Logic)
interface DocumentRepository {
  store(document: Document): Promise<void>;
  findById(id: string): Promise<Document>;
  search(query: SearchQuery): Promise<Document[]>;
}

// Application Layer (Use Cases)
class ProcessDocumentUseCase {
  constructor(
    private documentRepo: DocumentRepository,
    private vectorService: VectorService,
    private embeddingService: EmbeddingService
  ) {}
}

// Infrastructure Layer (External Concerns)
class QdrantDocumentRepository implements DocumentRepository {
  // Implementation details
}
```

## 6. Comprehensive Setup Guide

### 6.1 Prerequisites

#### **System Requirements**
- Node.js 18.x or higher
- Docker and Docker Compose
- Git
- 8GB RAM minimum
- 10GB free disk space

#### **Required API Keys**
- Google Drive API credentials
- OpenAI API key (or alternative LLM provider)
- Qdrant Cloud account (optional, for cloud deployment)

### 6.2 Environment Setup

#### **Step 1: Clone and Install**
```bash
git clone https://github.com/sisirapr/doc-qa-system.git
cd doc-qa-system
npm install
```

#### **Step 2: Environment Configuration**
```bash
cp .env.example .env
```

**.env Configuration**:
```env
# Database
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=your_qdrant_api_key

# Google Drive
GOOGLE_DRIVE_CLIENT_ID=your_client_id
GOOGLE_DRIVE_CLIENT_SECRET=your_client_secret
GOOGLE_DRIVE_REDIRECT_URI=http://localhost:3000/auth/callback

# LLM Provider
OPENAI_API_KEY=your_openai_key
LLM_PROVIDER=openai
EMBEDDING_MODEL=text-embedding-3-small

# Application
PORT=3000
NODE_ENV=development
LOG_LEVEL=info

# MCP Server
MCP_SERVER_PORT=3001
MCP_SERVER_HOST=localhost
```

#### **Step 3: Google Drive API Setup**
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create new project or select existing
3. Enable Google Drive API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URIs
6. Download credentials JSON

#### **Step 4: Database Setup**
```bash
# Start Qdrant with Docker
docker-compose up -d qdrant

# Verify Qdrant is running
curl http://localhost:6333/health
```

#### **Step 5: Initialize Database**
```bash
npm run db:setup
npm run db:migrate
```

### 6.3 Development Workflow

#### **Start Development Servers**
```bash
# Terminal 1: Start Qdrant
docker-compose up qdrant

# Terminal 2: Start MCP Server
npm run mcp:dev

# Terminal 3: Start API Server
npm run api:dev

# Terminal 4: Start Frontend
npm run frontend:dev
```

#### **Available Scripts**
```json
{
  "scripts": {
    "dev": "concurrently \"npm:api:dev\" \"npm:frontend:dev\" \"npm:mcp:dev\"",
    "api:dev": "nodemon src/api/server.ts",
    "frontend:dev": "cd frontend && npm run dev",
    "mcp:dev": "nodemon src/mcp/server.ts",
    "build": "npm run build:api && npm run build:frontend",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "lint": "eslint src --ext .ts,.tsx",
    "lint:fix": "eslint src --ext .ts,.tsx --fix",
    "type-check": "tsc --noEmit",
    "db:setup": "node scripts/setup-database.js",
    "db:reset": "node scripts/reset-database.js"
  }
}
```

### 6.5 Deployment Guide

#### **Production Environment Setup**

1. **Environment Variables**
```bash
# Production .env
NODE_ENV=production
QDRANT_URL=https://your-qdrant-cluster.qdrant.io
API_BASE_URL=https://your-domain.com/api
```

2. **Docker Production Build**
```bash
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d
```

---

This plan provides a solid foundation for building a robust, scalable document Q&A system with proper error handling, clean architecture, and comprehensive setup procedures. Each component is designed to be testable, maintainable, and extensible.