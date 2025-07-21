#!/bin/bash

# Document Q&A System Setup Script

echo "Setting up Document Q&A System..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Node.js is not installed. Please install Node.js 18.x or higher."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d 'v' -f 2 | cut -d '.' -f 1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "Node.js version 18.x or higher is required. Current version: $(node -v)"
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "npm is not installed. Please install npm."
    exit 1
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "Docker is not installed. It's recommended for running Qdrant vector database."
    echo "You can continue without Docker, but you'll need to set up Qdrant separately."
    read -p "Continue without Docker? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Create necessary directories
echo "Creating necessary directories..."
mkdir -p src/api/controllers
mkdir -p src/api/routes
mkdir -p src/api/middleware
mkdir -p src/core/services
mkdir -p src/core/repositories
mkdir -p qdrant_data

# Install dependencies
echo "Installing dependencies..."
npm install

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "Creating .env file from .env.example..."
    cp .env.example .env
    echo "Please update the .env file with your credentials."
fi

# Start Qdrant if Docker is installed
if command -v docker &> /dev/null; then
    echo "Starting Qdrant vector database..."
    docker run -d -p 6333:6333 -p 6334:6334 -v $(pwd)/qdrant_data:/qdrant/storage --name doc-qa-qdrant qdrant/qdrant
    
    # Check if Qdrant started successfully
    if [ $? -eq 0 ]; then
        echo "Qdrant started successfully."
    else
        echo "Failed to start Qdrant. Please check Docker and try again."
    fi
fi

echo "Setup completed successfully!"
echo "To start the MCP server, run: npm run mcp:dev"
echo "For more information, see the README.md file."
