import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  enqueueOffline,
  getOfflineQueue,
  getOfflineQueueCount,
  dequeueOffline,
  syncOfflineQueue,
  clearOfflineQueue,
  type OfflineQueueItem,
} from "@/lib/offline-queue";

const LS: Record<string, string> = {};
beforeEach(() => {
  Object.keys(LS).forEach((k) => delete LS[k]);
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => LS[k] ?? null,
    setItem: (k: string, v: string) => { LS[k] = v; },
  });
});

describe("enqueueOffline", () => {
  it("adds item to queue", () => {
    enqueueOffline({ tableName: "customers", operation: "upsert", payload: { id: "1" } });
    const queue = getOfflineQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].tableName).toBe("customers");
    expect(queue[0].operation).toBe("upsert");
    expect(queue[0].retries).toBe(0);
    expect(queue[0].id).toMatch(/^oq-/);
  });

  it("prepends new items (newest first)", () => {
    enqueueOffline({ tableName: "a", operation: "upsert", payload: {} });
    enqueueOffline({ tableName: "b", operation: "upsert", payload: {} });
    const queue = getOfflineQueue();
    expect(queue[0].tableName).toBe("b");
    expect(queue[1].tableName).toBe("a");
  });
});

describe("dequeueOffline", () => {
  it("removes item by id", () => {
    enqueueOffline({ tableName: "a", operation: "upsert", payload: {} });
    const queue = getOfflineQueue();
    dequeueOffline(queue[0].id);
    expect(getOfflineQueue()).toHaveLength(0);
  });
});

describe("getOfflineQueueCount", () => {
  it("returns 0 for empty queue", () => {
    expect(getOfflineQueueCount()).toBe(0);
  });

  it("returns correct count", () => {
    enqueueOffline({ tableName: "a", operation: "upsert", payload: {} });
    enqueueOffline({ tableName: "b", operation: "upsert", payload: {} });
    expect(getOfflineQueueCount()).toBe(2);
  });
});

describe("syncOfflineQueue", () => {
  it("syncs all items successfully", async () => {
    enqueueOffline({ tableName: "a", operation: "upsert", payload: { id: "1" } });
    enqueueOffline({ tableName: "b", operation: "upsert", payload: { id: "2" } });
    const fn = vi.fn().mockResolvedValue(undefined);
    const synced = await syncOfflineQueue(fn);
    expect(synced).toBe(2);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(getOfflineQueue()).toHaveLength(0);
  });

  it("keeps failed items in queue", async () => {
    enqueueOffline({ tableName: "a", operation: "upsert", payload: {} });
    enqueueOffline({ tableName: "b", operation: "upsert", payload: {} });
    const fn = vi.fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("fail"));
    const synced = await syncOfflineQueue(fn);
    expect(synced).toBe(1);
    expect(getOfflineQueue()).toHaveLength(1);
    expect(getOfflineQueue()[0].retries).toBe(1);
  });

  it("drops items that exceed max retries", async () => {
    const item: OfflineQueueItem = {
      id: "oq-old", tableName: "a", operation: "upsert",
      payload: {}, createdAt: "2026-01-01", retries: 5,
    };
    localStorage.setItem("segilly_offline_write_queue_v1", JSON.stringify([item]));
    const fn = vi.fn();
    const synced = await syncOfflineQueue(fn);
    expect(synced).toBe(0);
    expect(fn).not.toHaveBeenCalled();
  });

  it("returns 0 for empty queue", async () => {
    const synced = await syncOfflineQueue(vi.fn());
    expect(synced).toBe(0);
  });
});

describe("clearOfflineQueue", () => {
  it("clears all items", () => {
    enqueueOffline({ tableName: "a", operation: "upsert", payload: {} });
    enqueueOffline({ tableName: "b", operation: "delete", payload: {} });
    clearOfflineQueue();
    expect(getOfflineQueue()).toHaveLength(0);
  });
});
