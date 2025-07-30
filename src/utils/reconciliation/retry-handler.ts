export interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  attemptsMade: number;
  totalDurationMs: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 8000,
  backoffMultiplier: 2,
};

export class RetryHandler {
  private config: RetryConfig;
  private circuitBreakerFailures: Map<string, { count: number; lastFailure: number }> = new Map();
  private readonly CIRCUIT_BREAKER_THRESHOLD = 5;
  private readonly CIRCUIT_BREAKER_RESET_TIME = 300000; // 5 minutes

  constructor(config: Partial<RetryConfig> = {}) {
    this.config = { ...DEFAULT_RETRY_CONFIG, ...config };
  }

  async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<RetryResult<T>> {
    const startTime = Date.now();
    let lastError: Error | null = null;

    // Check circuit breaker
    if (this.isCircuitBreakerOpen(operationName)) {
      return {
        success: false,
        error: `Circuit breaker open for ${operationName}. Too many recent failures.`,
        attemptsMade: 0,
        totalDurationMs: Date.now() - startTime,
      };
    }

    for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
      try {
        console.log(`Attempting ${operationName} (attempt ${attempt}/${this.config.maxAttempts})`);
        
        const result = await operation();
        
        // Success - reset circuit breaker
        this.resetCircuitBreaker(operationName);
        
        return {
          success: true,
          data: result,
          attemptsMade: attempt,
          totalDurationMs: Date.now() - startTime,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(`${operationName} attempt ${attempt} failed:`, lastError.message);

        // If this is the last attempt, don't wait
        if (attempt === this.config.maxAttempts) {
          break;
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
          this.config.baseDelayMs * Math.pow(this.config.backoffMultiplier, attempt - 1),
          this.config.maxDelayMs
        );

        console.log(`Waiting ${delay}ms before retry...`);
        await this.sleep(delay);
      }
    }

    // All attempts failed - update circuit breaker
    this.recordFailure(operationName);

    return {
      success: false,
      error: lastError?.message || "Unknown error",
      attemptsMade: this.config.maxAttempts,
      totalDurationMs: Date.now() - startTime,
    };
  }

  private isCircuitBreakerOpen(operationName: string): boolean {
    const failures = this.circuitBreakerFailures.get(operationName);
    if (!failures) return false;

    const now = Date.now();
    const timeSinceLastFailure = now - failures.lastFailure;

    // Reset if enough time has passed
    if (timeSinceLastFailure > this.CIRCUIT_BREAKER_RESET_TIME) {
      this.resetCircuitBreaker(operationName);
      return false;
    }

    return failures.count >= this.CIRCUIT_BREAKER_THRESHOLD;
  }

  private recordFailure(operationName: string): void {
    const failures = this.circuitBreakerFailures.get(operationName) || { count: 0, lastFailure: 0 };
    failures.count += 1;
    failures.lastFailure = Date.now();
    this.circuitBreakerFailures.set(operationName, failures);

    if (failures.count >= this.CIRCUIT_BREAKER_THRESHOLD) {
      console.error(`Circuit breaker triggered for ${operationName} after ${failures.count} failures`);
    }
  }

  private resetCircuitBreaker(operationName: string): void {
    this.circuitBreakerFailures.delete(operationName);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getCircuitBreakerStatus(): Record<string, { count: number; lastFailure: number; isOpen: boolean }> {
    const status: Record<string, { count: number; lastFailure: number; isOpen: boolean }> = {};
    
    for (const [operationName, failures] of this.circuitBreakerFailures.entries()) {
      status[operationName] = {
        count: failures.count,
        lastFailure: failures.lastFailure,
        isOpen: this.isCircuitBreakerOpen(operationName),
      };
    }
    
    return status;
  }
}

// Singleton instance for global use
export const globalRetryHandler = new RetryHandler();