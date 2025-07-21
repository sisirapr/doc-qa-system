import { CircuitBreakerConfig, CircuitBreakerState, MCPError } from '../types/mcp-types';
import { RetryConfig } from '../../types';

/**
 * Default retry configuration
 */
export const defaultRetryConfig: RetryConfig = {
  maxAttempts: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  backoffMultiplier: 2, // Exponential backoff
  retryableErrors: [
    'RATE_LIMITED',
    'NETWORK_ERROR',
    'TIMEOUT_ERROR',
    'TEMPORARY_FAILURE'
  ]
};

/**
 * Default circuit breaker configuration
 */
export const defaultCircuitBreakerConfig: CircuitBreakerConfig = {
  failureThreshold: 5,
  recoveryTimeout: 30000, // 30 seconds
  monitoringWindow: 60000 // 1 minute
};

/**
 * Retry a function with exponential backoff
 * @param fn Function to retry
 * @param config Retry configuration
 * @returns Result of the function
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const retryConfig = { ...defaultRetryConfig, ...config };
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      // Check if error is retryable
      const errorCode = (error as MCPError).code || 'UNKNOWN_ERROR';
      if (!retryConfig.retryableErrors.includes(errorCode)) {
        throw error;
      }
      
      // Last attempt, don't delay
      if (attempt === retryConfig.maxAttempts) {
        throw error;
      }
      
      // Calculate delay with exponential backoff
      const delay = Math.min(
        retryConfig.baseDelay * Math.pow(retryConfig.backoffMultiplier, attempt - 1),
        retryConfig.maxDelay
      );
      
      // Add jitter to prevent thundering herd
      const jitter = Math.random() * 0.3 + 0.85; // 0.85-1.15
      const finalDelay = Math.floor(delay * jitter);
      
      console.log(`Retry attempt ${attempt}/${retryConfig.maxAttempts} after ${finalDelay}ms`);
      await new Promise(resolve => setTimeout(resolve, finalDelay));
    }
  }
  
  // This should never happen due to the throw in the loop
  throw lastError || new Error('Retry failed');
}

/**
 * Circuit breaker class to prevent repeated calls to failing services
 */
export class CircuitBreaker {
  private state: CircuitBreakerState;
  private config: CircuitBreakerConfig;
  
  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = { ...defaultCircuitBreakerConfig, ...config };
    this.state = {
      status: 'closed',
      failures: 0,
      lastFailure: null,
      nextAttempt: null
    };
  }
  
  /**
   * Execute a function with circuit breaker protection
   * @param fn Function to execute
   * @returns Result of the function
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.updateState();
    
    if (this.state.status === 'open') {
      throw new MCPError(
        'Circuit is open, too many failures',
        'CIRCUIT_OPEN',
        503
      );
    }
    
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  /**
   * Update circuit state based on time elapsed
   */
  private updateState(): void {
    const now = Date.now();
    
    if (this.state.status === 'open' && this.state.nextAttempt && now >= this.state.nextAttempt) {
      this.state.status = 'half-open';
    }
  }
  
  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    if (this.state.status === 'half-open') {
      this.reset();
    }
  }
  
  /**
   * Handle failed execution
   */
  private onFailure(): void {
    const now = Date.now();
    this.state.failures++;
    this.state.lastFailure = now;
    
    // Check if we need to open the circuit
    if (this.state.status === 'closed') {
      // Only count failures within the monitoring window
      const failuresInWindow = this.state.failures;
      
      if (failuresInWindow >= this.config.failureThreshold) {
        this.state.status = 'open';
        this.state.nextAttempt = now + this.config.recoveryTimeout;
      }
    } else if (this.state.status === 'half-open') {
      this.state.status = 'open';
      this.state.nextAttempt = now + this.config.recoveryTimeout;
    }
  }
  
  /**
   * Reset the circuit breaker
   */
  private reset(): void {
    this.state = {
      status: 'closed',
      failures: 0,
      lastFailure: null,
      nextAttempt: null
    };
  }
  
  /**
   * Get current circuit state
   */
  getState(): CircuitBreakerState {
    this.updateState();
    return { ...this.state };
  }
}

/**
 * Create a standardized error response
 * @param message Error message
 * @param code Error code
 * @param statusCode HTTP status code
 * @param details Additional error details
 * @returns MCPError
 */
export function createError(
  message: string,
  code: string,
  statusCode: number = 500,
  details?: any
): MCPError {
  return new MCPError(message, code, statusCode, details);
}

/**
 * Validate input against required fields
 * @param input Input object
 * @param requiredFields Array of required field names
 * @throws MCPError if validation fails
 */
export function validateInput(input: Record<string, any>, requiredFields: string[]): void {
  const missingFields = requiredFields.filter(field => input[field] === undefined);
  
  if (missingFields.length > 0) {
    throw createError(
      `Missing required fields: ${missingFields.join(', ')}`,
      'INVALID_INPUT',
      400,
      { missingFields }
    );
  }
}

/**
 * Measure execution time of a function
 * @param fn Function to measure
 * @returns Tuple of [result, executionTimeMs]
 */
export async function measureExecutionTime<T>(
  fn: () => Promise<T>
): Promise<[T, number]> {
  const startTime = Date.now();
  const result = await fn();
  const endTime = Date.now();
  return [result, endTime - startTime];
}

/**
 * Generate a unique ID
 * @returns Unique ID string
 */
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}
