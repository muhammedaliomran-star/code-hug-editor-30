import { describe, it, expect, vi, beforeEach } from "vitest";
import { withRetry } from "@/lib/retry";

describe("withRetry", () => {
  it("returns result on first success", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await withRetry(fn);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on failure and succeeds", async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValue("ok");
    const result = await withRetry(fn, { maxRetries: 3, baseDelayMs: 10 });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("throws after all retries exhausted", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("always fail"));
    await expect(withRetry(fn, { maxRetries: 3, baseDelayMs: 10 }))
      .rejects.toThrow("always fail");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("calls onRetry callback", async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error("fail1"))
      .mockRejectedValueOnce(new Error("fail2"))
      .mockResolvedValue("ok");
    const onRetry = vi.fn();
    const result = await withRetry(fn, { maxRetries: 3, baseDelayMs: 10, onRetry });
    expect(result).toBe("ok");
    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error));
    expect(onRetry).toHaveBeenCalledWith(2, expect.any(Error));
  });

  it("does not retry on success", async () => {
    const fn = vi.fn().mockResolvedValue(42);
    await withRetry(fn, { maxRetries: 5 });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("defaults to 3 retries", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("nope"));
    await expect(withRetry(fn)).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("respects custom maxRetries", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("nope"));
    await expect(withRetry(fn, { maxRetries: 1 })).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("uses exponential backoff delays", async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error("f1"))
      .mockRejectedValueOnce(new Error("f2"))
      .mockResolvedValue("ok");
    const start = Date.now();
    await withRetry(fn, { maxRetries: 3, baseDelayMs: 50, backoffFactor: 2 });
    const elapsed = Date.now() - start;
    // Should wait ~50ms + ~100ms = ~150ms total
    expect(elapsed).toBeGreaterThanOrEqual(100);
  });
});
