import { describe, expect, it } from "vitest";
import { checkBurstRateLimit } from "../rateLimit";

function fakeSupabase(count: number) {
  return {
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                gte() {
                  return Promise.resolve({ count, error: null });
                },
              };
            },
          };
        },
      };
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("checkBurstRateLimit", () => {
  it("既定値(60秒5回)未満なら制限しない", async () => {
    const result = await checkBurstRateLimit(fakeSupabase(4), "user-1");
    expect(result.limited).toBe(false);
  });

  it("既定の上限に達したら制限する", async () => {
    const result = await checkBurstRateLimit(fakeSupabase(5), "user-1");
    expect(result.limited).toBe(true);
    expect(result.retryAfterSeconds).toBe(60);
  });

  it("カスタムしきい値を尊重する", async () => {
    const result = await checkBurstRateLimit(fakeSupabase(2), "user-1", {
      maxRequests: 2,
      windowSeconds: 30,
    });
    expect(result.limited).toBe(true);
    expect(result.retryAfterSeconds).toBe(30);
  });
});
