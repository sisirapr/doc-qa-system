import Anthropic from '@anthropic-ai/sdk';
import { env } from '../config/environment';
import { createError } from '../mcp/utils/mcp-helpers';

// Initialize Anthropic client
let anthropicClient: Anthropic | null = null;

if (env.ANTHROPIC_API_KEY) {
  anthropicClient = new Anthropic({
    apiKey: env.ANTHROPIC_API_KEY,
  });
  console.log('Anthropic client initialized');
} else {
  console.warn('Anthropic API key not provided, using mock responses');
}

/**
 * Generate text completion using Anthropic Claude
 * @param prompt The input prompt
 * @param maxTokens Maximum tokens to generate
 * @param temperature Temperature for randomness (0-1)
 * @returns Generated text response
 */
export async function generateCompletion(
  prompt: string,
  maxTokens: number = 1000,
  temperature: number = 0.7
): Promise<string> {
  try {
    if (!anthropicClient) {
      // Return mock response if no API key
      return `Mock response for prompt: "${prompt.substring(0, 50)}..."`;
    }

    const response = await anthropicClient.messages.create({
      model: env.LLM_MODEL,
      max_tokens: maxTokens,
      temperature,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    // Extract text content from the response
    const textContent = response.content
      .filter(content => content.type === 'text')
      .map(content => content.text)
      .join('');

    return textContent;
  } catch (error) {
    console.error('Error generating completion with Anthropic:', error);
    throw createError(
      'Failed to generate text completion',
      'ANTHROPIC_ERROR',
      500,
      { originalError: (error as Error).message }
    );
  }
}

/**
 * Generate embeddings using OpenAI (fallback for embeddings since Anthropic doesn't provide embeddings)
 * Note: For production, you might want to use a dedicated embedding service
 * @param text Text to embed
 * @returns Embedding vector
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    // For now, return mock embeddings
    // In production, you would use OpenAI's embedding API or another embedding service
    console.log(`Generating mock embedding for text: ${text.substring(0, 50)}...`);
    
    // Generate a consistent mock embedding based on text content
    const hash = Array.from(text).reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const embedding = Array.from({ length: 10 }, (_, i) => {
      return Math.sin(hash * (i + 1) * 0.1) * Math.cos(hash * (i + 1) * 0.05);
    });
    
    return embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw createError(
      'Failed to generate embedding',
      'EMBEDDING_ERROR',
      500,
      { originalError: (error as Error).message }
    );
  }
}

/**
 * Generate answer for document Q&A using retrieved context
 * @param question The user's question
 * @param context Retrieved document chunks
 * @returns Generated answer
 */
export async function generateAnswer(
  question: string,
  context: string[]
): Promise<string> {
  try {
    const contextText = context.join('\n\n');
    const prompt = `Based on the following context, please answer the question. If the answer cannot be found in the context, please say so.

Context:
${contextText}

Question: ${question}

Answer:`;

    return await generateCompletion(prompt, 500, 0.3);
  } catch (error) {
    console.error('Error generating answer:', error);
    throw createError(
      'Failed to generate answer',
      'ANSWER_GENERATION_ERROR',
      500,
      { originalError: (error as Error).message }
    );
  }
}

/**
 * Check if Anthropic client is available
 * @returns True if client is initialized
 */
export function isAnthropicAvailable(): boolean {
  return anthropicClient !== null;
}
