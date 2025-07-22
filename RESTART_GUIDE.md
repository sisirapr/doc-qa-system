# 🚀 Document Q&A System - Restart Guide

This guide provides step-by-step instructions to restart the entire Document Q&A system after making changes or when starting fresh.

## 📋 Prerequisites

Before restarting, ensure you have:
- Node.js 18.x or higher installed
- Docker and Docker Compose installed
- All environment variables configured in `.env` file
- API keys for Google Drive, OpenAI/Anthropic, and Qdrant

## 🔄 Complete System Restart

### Step 1: Stop All Running Services

```bash
# Stop any running Node.js processes
pkill -f "node"
pkill -f "npm"
pkill -f "tsx"

# Stop Docker containers
docker-compose down

# Alternative: Stop specific containers
docker stop qdrant-container
```

### Step 2: Start Database Services

```bash
# Start Qdrant vector database
docker-compose up -d qdrant

# Verify Qdrant is running
curl http://localhost:6333/health
# Should return: {"title":"qdrant - vector search engine","version":"..."}
```

### Step 3: Start Backend Services

Open **3 separate terminal windows/tabs** and run:

#### Terminal 1: MCP Server
```bash
cd /Users/sisirapr/Projects/Interviews
npm run mcp:dev
```
**Expected output:**
```
MCP Server running at http://localhost:3001
Available tools: google_drive_list_files, google_drive_download_file, document_chunk_and_embed, vector_similarity_search, document_qa_query, vector_stats
```

#### Terminal 2: API Server
```bash
cd /Users/sisirapr/Projects/Interviews
npm run api:dev
```
**Expected output:**
```
API Server running on http://localhost:3000
✓ Connected to Qdrant at http://localhost:6333
✓ AI services initialized
```

#### Terminal 3: Frontend
```bash
cd /Users/sisirapr/Projects/Interviews
npm run frontend:dev
```
**Expected output:**
```
▲ Next.js 14.x.x
- Local:        http://localhost:3002
- Ready in 2.1s
```

### Step 4: Verify System Health

#### Check All Services:
```bash
# Check MCP Server
curl http://localhost:3001/health

# Check API Server
curl http://localhost:3000/api/health

# Check Frontend
curl http://localhost:3002
```

#### Test Real-Time Statistics:
```bash
# Test statistics endpoint
curl http://localhost:3000/api/documents/stats
```

## 🚀 Quick Restart Commands

### Option 1: Individual Services
```bash
# Terminal 1: MCP Server
npm run mcp:dev

# Terminal 2: API Server  
npm run api:dev

# Terminal 3: Frontend
npm run frontend:dev
```

### Option 2: All Services (if configured)
```bash
# Start all services concurrently
npm run dev
```

## 🐳 Docker-Based Restart (Alternative)

If you prefer using Docker for everything:

```bash
# Stop all containers
docker-compose down

# Rebuild and start all services
docker-compose up --build -d

# View logs
docker-compose logs -f
```

## 🔧 Troubleshooting

### Common Issues and Solutions:

#### 1. Port Already in Use
```bash
# Find and kill processes using ports
lsof -ti:3000 | xargs kill -9  # API Server
lsof -ti:3001 | xargs kill -9  # MCP Server
lsof -ti:3002 | xargs kill -9  # Frontend
lsof -ti:6333 | xargs kill -9  # Qdrant
```

#### 2. Qdrant Connection Issues
```bash
# Restart Qdrant container
docker restart qdrant-container

# Check Qdrant logs
docker logs qdrant-container
```

#### 3. Environment Variables Missing
```bash
# Copy example environment file
cp .env.example .env

# Edit with your actual values
nano .env
```

#### 4. Node Modules Issues
```bash
# Clean install dependencies
rm -rf node_modules package-lock.json
npm install

# For frontend
cd frontend
rm -rf node_modules package-lock.json
npm install
cd ..
```

#### 5. TypeScript Compilation Errors
```bash
# Clean TypeScript cache
npx tsc --build --clean

# Rebuild
npm run build
```

## 📊 Verify Real-Time Statistics

After restart, test the real-time statistics:

1. **Open Frontend**: http://localhost:3002
2. **Check Statistics**: Should show real numbers from database
3. **Test Query**: Ask a question to see query count increment
4. **Test Sync**: Connect Google Drive to see document count update

## 🎯 System URLs

After successful restart, access:

- **Frontend**: http://localhost:3002
- **API Server**: http://localhost:3000
- **MCP Server**: http://localhost:3001
- **Qdrant Dashboard**: http://localhost:6333/dashboard
- **API Health**: http://localhost:3000/api/health

## 📝 Development Workflow

For active development:

1. **Make Code Changes**
2. **Services Auto-Reload** (using nodemon/Next.js dev mode)
3. **Test Changes** in browser
4. **Commit & Push** when ready

## 🆘 Emergency Reset

If everything fails:

```bash
# Nuclear option - reset everything
docker system prune -a
rm -rf node_modules frontend/node_modules
npm install
cd frontend && npm install && cd ..
docker-compose up -d qdrant
npm run dev
```

## 📞 Support

If you encounter issues:
1. Check the terminal outputs for error messages
2. Verify all environment variables are set
3. Ensure all ports are available
4. Check Docker container status
5. Review the logs for specific error details

---

**Happy Coding! 🚀**
