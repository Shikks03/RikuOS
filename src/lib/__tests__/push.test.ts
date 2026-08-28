import { describe, it, expect } from "vitest";
import { buildPushPayload, parseSubscription } from "@/lib/push";

describe("buildPushPayload", () => {
  it("passes short values through with the default url", () => {
    expect(buildPushPayload("Title", "Body")).toEqual({
      title: "Title",
      body: "Body",
      url: "/queue",
    });
  });

  it("truncates title to 80 and body to 200 chars", () => {
    const p = buildPushPayload("t".repeat(100), "b".repeat(300));
    expect(p.title).toHaveLength(80);
    expect(p.body).toHaveLength(200);
  });

  it("accepts an explicit url", () => {
    expect(buildPushPayload("T", "B", "/queue?status=pending").url).toBe(
      "/queue?status=pending"
    );
  });
});

describe("parseSubscription", () => {
  const valid = { endpoint: "https://push.example/abc", keys: { p256dh: "k1", auth: "k2" } };

  it("accepts a valid subscription", () => {
    expect(parseSubscription(valid)).toEqual(valid);
  });

  it("ignores extra fields (browsers send expirationTime)", () => {
    expect(parseSubscription({ ...valid, expirationTime: null })).toEqual(valid);
  });

  it("rejects a non-https endpoint", () => {
    expect(parseSubscription({ ...valid, endpoint: "http://push.example/abc" })).toBeNull();
  });

  it("rejects missing keys", () => {
    expect(parseSubscription({ endpoint: valid.endpoint })).toBeNull();
    expect(parseSubscription({ endpoint: valid.endpoint, keys: { p256dh: "k1" } })).toBeNull();
  });

  it("rejects an over-length endpoint", () => {
    expect(parseSubscription({ ...valid, endpoint: "https://" + "x".repeat(1024) })).toBeNull();
  });

  it("rejects non-object bodies", () => {
    expect(parseSubscription(null)).toBeNull();
    expect(parseSubscription("str")).toBeNull();
  });
});
