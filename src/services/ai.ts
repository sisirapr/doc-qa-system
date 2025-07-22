import { generateText, embed } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import { env } from '../config/environment';
import { createError } from '../mcp/utils/mcp-helpers';

// Initialize AI providers based on configuration
const getLanguageModel = () => {
  if (env.LLM_PROVIDER === 'anthropic' && env.ANTHROPIC_API_KEY) {
    return anthropic(env.LLM_MODEL);
  } else if (env.LLM_PROVIDER === 'openai' && env.OPENAI_API_KEY) {
    return openai(env.LLM_MODEL || 'gpt-3.5-turbo');
  }
  return null;
};

const getEmbeddingModel = () => {
  // Anthropic doesn't provide embedding models, so we use OpenAI for embeddings
  // regardless of the LLM provider choice
  if (env.OPENAI_API_KEY) {
    return openai.embedding(env.EMBEDDING_MODEL);
  }
  return null;
};

/**
 * Generate text completion using Vercel AI SDK
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
    const model = getLanguageModel();
    
    if (!model) {
      // Return mock response if no model available
      console.warn('No AI model available, using mock response');
      return `Mock response for prompt: "${prompt.substring(0, 50)}..."`;
    }

    console.log(`Using ${env.LLM_PROVIDER} provider with model: ${env.LLM_MODEL}`);

    const { text } = await generateText({
      model,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      maxTokens,
      temperature,
    });

    return text;
  } catch (error) {
    console.error('Error generating completion with AI SDK:', error);
    throw createError(
      'Failed to generate text completion',
      'AI_COMPLETION_ERROR',
      500,
      { originalError: (error as Error).message }
    );
  }
}

/**
 * Generate embeddings using Vercel AI SDK
 * @param text Text to embed
 * @returns Embedding vector
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const model = getEmbeddingModel();
    
    if (!model) {
      // Return mock embeddings if no model available
      console.log(`Generating mock embedding for text: ${text.substring(0, 50)}...`);
      
      // Generate a consistent mock embedding based on text content
      const hash = Array.from(text).reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const embedding = Array.from({ length: 1536 }, (_, i) => {
        return Math.sin(hash * (i + 1) * 0.1) * Math.cos(hash * (i + 1) * 0.05);
      });
      
      return embedding;
    }

    const { embedding } = await embed({
      model,
      value: text,
    });

    // Return full embedding dimensions (1536 for text-embedding-3-small)
    return embedding;
  } catch (error) {
    console.error('Error generating embedding with AI SDK:', error);
    
    // Fallback to mock embedding on error
    console.log('Falling back to mock embedding');
    const hash = Array.from(text).reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const embedding = Array.from({ length: 1536 }, (_, i) => {
      return Math.sin(hash * (i + 1) * 0.1) * Math.cos(hash * (i + 1) * 0.05);
    });
    
    return embedding;
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
 * Check if AI models are available
 * @returns Object indicating which models are available
 */
export function getModelAvailability() {
  return {
    languageModel: getLanguageModel() !== null,
    embeddingModel: getEmbeddingModel() !== null,
    provider: env.LLM_PROVIDER,
    hasAnthropicKey: !!env.ANTHROPIC_API_KEY,
    hasOpenAIKey: !!env.OPENAI_API_KEY,
  };
}

// Log model availability on startup
const availability = getModelAvailability();
console.log('AI Model Availability:', availability);
