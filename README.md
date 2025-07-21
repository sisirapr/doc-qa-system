# Document Q&A System

A system that allows users to ask questions about their documents and get accurate answers based on the document content.

## Features

- Google Drive integration for document access
- Document processing with chunking and embedding
- Vector search for finding relevant document chunks
- Question answering using LLM

## Prerequisites

- Node.js 18.x or higher
- npm or yarn
- Docker (for running Qdrant vector database)

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/yourusername/doc-qa-system.git
cd doc-qa-system
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

Copy the example environment file and update it with your credentials:

```bash
cp .env.example .env
```

Edit the `.env` file and update the following variables:

- `GOOGLE_DRIVE_CLIENT_ID`: Your Google Drive OAuth client ID
- `GOOGLE_DRIVE_CLIENT_SECRET`: Your Google Drive OAuth client secret
- `OPENAI_API_KEY`: Your OpenAI API key (if using OpenAI for embeddings/LLM)

### 4. Start Qdrant vector database

```bash
docker run -p 6333:6333 -p 6334:6334 -v $(pwd)/qdrant_data:/qdrant/storage qdrant/qdrant
```

## Running the System

### Start the MCP Server

The MCP (Model Context Protocol) server provides tools for document processing, vector search, and question answering.

```bash
npm run mcp:dev
```

This will start the MCP server at http://localhost:3001.

### Start the API Server (when implemented)

```bash
npm run api:dev
```

This will start the API server at http://localhost:3000.

### Start both servers simultaneously

```bash
npm run dev
```

This will start both the MCP server and API server concurrently.

## Usage

### MCP Server Endpoints

- `GET /health`: Health check endpoint
- `POST /tools/:toolName`: Execute a tool
- `GET /resources/:resourceType/:resourceId`: Access a resource

### Available Tools

- `google_drive_list_files`: List files in Google Drive
- `google_drive_download_file`: Download a file from Google Drive
- `document_chunk_and_embed`: Process and embed a document
- `vector_similarity_search`: Search for similar document chunks
- `document_qa_query`: Answer questions about documents

### Example: Using the document_qa_query tool

```bash
curl -X POST http://localhost:3001/tools/document_qa_query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What is vector search?",
    "maxResults": 5,
    "temperature": 0.7
  }'
```

## Development

### Project Structure

```
doc-qa-system/
├── src/
│   ├── api/                    # API routes and controllers (to be implemented)
│   ├── core/                   # Core business logic (to be implemented)
│   ├── mcp/                    # MCP server implementation
│   │   ├── server.ts           # MCP server
│   │   ├── tools/              # MCP tools
│   │   ├── types/              # MCP types
│   │   └── utils/              # MCP utilities
│   ├── config/                 # Configuration
│   └── types/                  # TypeScript definitions
├── .env                        # Environment variables
├── .env.example                # Example environment variables
├── package.json                # Project dependencies and scripts
└── tsconfig.json               # TypeScript configuration
```

### Running Tests (when implemented)

```bash
npm test
```

### Building for Production

```bash
npm run build
```

This will compile the TypeScript code to JavaScript in the `dist` directory.

### Starting in Production Mode

```bash
npm start
```

## License

MIT
