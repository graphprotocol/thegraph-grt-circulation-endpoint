import { RetryHandler } from '../../utils/reconciliation/retry-handler';

describe('RetryHandler', () => {
  let retryHandler: RetryHandler;

  beforeEach(() => {
    retryHandler = new RetryHandler({
      maxAttempts: 3,
      baseDelayMs: 100, // Fast for testing
      maxDelayMs: 1000,
      backoffMultiplier: 2,
    });
  });

  it('should succeed on first attempt when operation succeeds', async () => {
    const mockOperation = jest.fn().mockResolvedValue('success');
    
    const result = await retryHandler.executeWithRetry(mockOperation, 'test-operation');
    
    expect(result.success).toBe(true);
    expect(result.data).toBe('success');
    expect(result.attemptsMade).toBe(1);
    expect(mockOperation).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure and eventually succeed', async () => {
    const mockOperation = jest.fn()
      .mockRejectedValueOnce(new Error('First failure'))
      .mockRejectedValueOnce(new Error('Second failure'))
      .mockResolvedValue('success');
    
    const result = await retryHandler.executeWithRetry(mockOperation, 'test-operation');
    
    expect(result.success).toBe(true);
    expect(result.data).toBe('success');
    expect(result.attemptsMade).toBe(3);
    expect(mockOperation).toHaveBeenCalledTimes(3);
  });

  it('should fail after max attempts', async () => {
    const mockOperation = jest.fn().mockRejectedValue(new Error('Persistent failure'));
    
    const result = await retryHandler.executeWithRetry(mockOperation, 'test-operation');
    
    expect(result.success).toBe(false);
    expect(result.error).toBe('Persistent failure');
    expect(result.attemptsMade).toBe(3);
    expect(mockOperation).toHaveBeenCalledTimes(3);
  });

  it('should trigger circuit breaker after multiple failures', async () => {
    const mockOperation = jest.fn().mockRejectedValue(new Error('Circuit breaker test'));
    
    // Fail 5 times to trigger circuit breaker
    for (let i = 0; i < 5; i++) {
      await retryHandler.executeWithRetry(mockOperation, 'circuit-test');
    }
    
    // Next attempt should be blocked by circuit breaker
    const result = await retryHandler.executeWithRetry(mockOperation, 'circuit-test');
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('Circuit breaker open');
    expect(result.attemptsMade).toBe(0);
  });

  it('should track circuit breaker status', async () => {
    const mockOperation = jest.fn().mockRejectedValue(new Error('Status test'));
    
    // Trigger some failures
    await retryHandler.executeWithRetry(mockOperation, 'status-test');
    await retryHandler.executeWithRetry(mockOperation, 'status-test');
    
    const status = retryHandler.getCircuitBreakerStatus();
    
    expect(status['status-test']).toBeDefined();
    expect(status['status-test'].count).toBe(2);
    expect(status['status-test'].isOpen).toBe(false);
  });
});