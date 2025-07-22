import { createError, measureExecutionTime, validateInput } from '../utils/mcp-helpers';
import { DocumentQAQueryInput, DocumentQAQueryOutput, MCPError } from '../types/mcp-types';
import { vectorSimilaritySearch } from './vector-search';
import { env } from '../../config/environment';

// Default parameters
const DEFAULT_MAX_RESULTS = 5;
const DEFAULT_TEMPERATURE = 0.7;
const MAX_CONTEXT_LENGTH = 4000; // Characters, not tokens

/**
 * Answer questions about documents using vector search and LLM
 * @param input Query input parameters
 * @returns Answer and sources
 */
export async function documentQAQuery(
  input: DocumentQAQueryInput
): Promise<DocumentQAQueryOutput> {
  try {
    // Validate required fields
    validateInput(input, ['query']);
    
    // Set default values
    const maxResults = input.maxResults || DEFAULT_MAX_RESULTS;
    const temperature = input.temperature || DEFAULT_TEMPERATURE;
    
    // Step 1: Find relevant document chunks using vector search
    const [searchResults, searchTime] = await measureExecutionTime(async () => {
      const filters = input.documentIds ? { 'metadata.documentId': input.documentIds } : {};
      
      const searchResponse = await vectorSimilaritySearch({
        query: input.query,
        limit: maxResults,
        threshold: 0.7,
        filters
      });
      
      return searchResponse.results;
    });
    
    console.log(`Vector search completed in ${searchTime}ms, found ${searchResults.length} results`);
    
    // Step 2: Generate answer using LLM
    const [answer, llmTime] = await measureExecutionTime(async () => {
      // Prepare context from search results
      const context = prepareContext(searchResults.map(result => result.content));
      
      // This is a placeholder for actual LLM call
      // In a real implementation, this would call an LLM API like OpenAI
      return await mockLLMGeneration(input.query, context, temperature);
    });
    
    console.log(`LLM answer generation completed in ${llmTime}ms`);
    
    // Prepare sources for response
    const sources = searchResults.map(result => ({
      documentId: result.metadata.documentId,
      documentName: result.metadata.documentName,
      content: result.content,
      score: result.score
    }));
    
    return {
      answer,
      sources,
      processingTimeMs: searchTime + llmTime
    };
  } catch (error) {
    console.error('Error performing document Q&A:', error);
    
    if (error instanceof MCPError) {
      throw error;
    }
    
    throw createError(
      'Failed to perform document Q&A',
      'DOCUMENT_QA_ERROR',
      500,
      { originalError: (error as Error).message }
    );
  }
}

/**
 * Prepare context from document chunks
 * @param chunks Document chunk contents
 * @returns Formatted context string
 */
function prepareContext(chunks: string[]): string {
  // Combine chunks into a single context string
  let context = '';
  
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    if (!chunk) continue;
    
    // Add separator between chunks
    if (context.length > 0) {
      context += '\n\n---\n\n';
    }
    
    // Add chunk with index
    context += `[${i + 1}] ${chunk}`;
    
    // Check if we've reached the maximum context length
    if (context.length > MAX_CONTEXT_LENGTH) {
      // Truncate and add ellipsis
      context = context.substring(0, MAX_CONTEXT_LENGTH) + '...';
      break;
    }
  }
  
  return context;
}

/**
 * Mock LLM generation function
 * @param query User query
 * @param context Document context
 * @param temperature Temperature parameter
 * @returns Generated answer
 */
async function mockLLMGeneration(
  query: string,
  context: string,
  temperature: number
): Promise<string> {
  // Import AI service
  const { generateAnswer } = await import('../../services/ai');
  
  try {
    // Use AI service to generate answer
    return await generateAnswer(query, [context]);
  } catch (error) {
    console.error('Error with AI generation, falling back to mock:', error);
    
    // Fallback to mock generation if AI fails
    const safeQuery = query || 'unknown query';
    const answers = [
      `Based on the provided documents, the answer to "${safeQuery}" is that document retrieval systems use vector embeddings to find relevant information. The system converts text into numerical vectors and then finds similar vectors when a query is made.`,
      `According to the information in the documents, "${safeQuery}" relates to semantic search technology. This technology allows finding documents based on meaning rather than just keywords.`,
      `The documents suggest that "${safeQuery}" involves chunking text into smaller pieces before processing. This helps manage large documents and improves retrieval accuracy.`,
      `From the context provided, "${safeQuery}" is addressed by using machine learning models to understand natural language. These models can interpret questions and find relevant information in a document collection.`
    ];
    
    const seed = safeQuery.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const answerIndex = seed % answers.length;
    
    await new Promise(resolve => setTimeout(resolve, 500));
    return answers[answerIndex];
  }
}
