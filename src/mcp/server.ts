import express from 'express';
import cors from 'cors';
import { json } from 'body-parser';
import { tools, ToolName } from './tools';
import { createError } from './utils/mcp-helpers';
import { env } from '../config/environment';
import { MCPError } from './types/mcp-types';

// Create Express app
const app = express();

// Middleware
app.use(cors({
  origin: env.CORS_ORIGIN,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(json({ limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Tool execution endpoint
app.post('/tools/:toolName', async (req, res) => {
  const { toolName } = req.params;
  const input = req.body;
  
  console.log(`Executing tool: ${toolName}`);
  
  try {
    // Validate tool name
    if (!isValidToolName(toolName)) {
      throw createError(
        `Tool not found: ${toolName}`,
        'TOOL_NOT_FOUND',
        404
      );
    }
    
    // Execute tool
    const tool = tools[toolName as ToolName];
    const result = await tool(input);
    
    // Return result
    res.status(200).json({
      success: true,
      data: result,
      metadata: {
        timestamp: new Date().toISOString(),
        tool: toolName
      }
    });
  } catch (error) {
    console.error(`Error executing tool ${toolName}:`, error);
    
    // Handle MCPError
    if (error instanceof MCPError) {
      res.status(error.statusCode).json({
        success: false,
        error: {
          message: error.message,
          code: error.code,
          details: error.details
        },
        metadata: {
          timestamp: new Date().toISOString(),
          tool: toolName
        }
      });
      return;
    }
    
    // Handle other errors
    res.status(500).json({
      success: false,
      error: {
        message: (error as Error).message || 'Unknown error',
        code: 'INTERNAL_SERVER_ERROR',
        details: null
      },
      metadata: {
        timestamp: new Date().toISOString(),
        tool: toolName
      }
    });
  }
});

// Resource access endpoint
app.get('/resources/:resourceType/:resourceId', async (req, res) => {
  const { resourceType, resourceId } = req.params;
  
  console.log(`Accessing resource: ${resourceType}/${resourceId}`);
  
  try {
    // This is a placeholder for actual resource access
    // In a real implementation, this would access resources like documents, embeddings, etc.
    
    // For now, return a mock response
    res.status(200).json({
      success: true,
      data: {
        resourceType,
        resourceId,
        name: `${resourceType}-${resourceId}`,
        metadata: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      },
      metadata: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error(`Error accessing resource ${resourceType}/${resourceId}:`, error);
    
    // Handle MCPError
    if (error instanceof MCPError) {
      res.status(error.statusCode).json({
        success: false,
        error: {
          message: error.message,
          code: error.code,
          details: error.details
        },
        metadata: {
          timestamp: new Date().toISOString()
        }
      });
      return;
    }
    
    // Handle other errors
    res.status(500).json({
      success: false,
      error: {
        message: (error as Error).message || 'Unknown error',
        code: 'INTERNAL_SERVER_ERROR',
        details: null
      },
      metadata: {
        timestamp: new Date().toISOString()
      }
    });
  }
});

// Start server
const PORT = env.MCP_SERVER_PORT;
const HOST = env.MCP_SERVER_HOST;

app.listen(PORT, () => {
  console.log(`MCP Server running at http://${HOST}:${PORT}`);
  console.log(`Available tools: ${Object.keys(tools).join(', ')}`);
});

/**
 * Check if tool name is valid
 * @param toolName Tool name to check
 * @returns True if tool name is valid
 */
function isValidToolName(toolName: string): toolName is ToolName {
  return Object.keys(tools).includes(toolName);
}

// Export for testing
export default app;
