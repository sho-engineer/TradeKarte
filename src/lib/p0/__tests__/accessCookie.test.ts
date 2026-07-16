import { describe, expect, it } from "vitest";
import {
  ACCESS_COOKIE_TTL_SECONDS,
  issueAccessToken,
  verifyAccessCode,
  verifyAccessToken,
} from "../accessCookie";

const SECRET = "test-secret-which-is-long-enough-for-hmac";

describe("アクセスコードCookie(§2.1)", () => {
  it("ACCESS-001: 発行したトークンが検証を通る", async () => {
    const token = await issueAccessToken(SECRET);
    expect(await verifyAccessToken(SECRET, token)).toBe(true);
  });

  it("ACCESS-002: アクセスコード照合(定数時間比較)", async () => {
    expect(await verifyAccessCode("correct-code", "correct-code")).toBe(true);
    expect(await verifyAccessCode("wrong-code", "correct-code")).toBe(false);
    expect(await verifyAccessCode("", "correct-code")).toBe(false);
    expect(await verifyAccessCode("x", "")).toBe(false);
  });

  it("ACCESS-003: 署名改ざんを拒否する", async () => {
    const token = await issueAccessToken(SECRET);
    const [v, exp, sig] = token.split(".");
    const tamperedSig = `${v}.${exp}.${sig.slice(0, -2)}xx`;
    expect(await verifyAccessToken(SECRET, tamperedSig)).toBe(false);

    // 有効期限の書き換えも署名不一致で拒否
    const tamperedExp = `${v}.${Number(exp) + 9999}.${sig}`;
    expect(await verifyAccessToken(SECRET, tamperedExp)).toBe(false);

    // 別シークレットで署名したものを拒否
    const other = await issueAccessToken("another-secret");
    expect(await verifyAccessToken(SECRET, other)).toBe(false);
  });

  it("ACCESS-003: 期限切れ・形式不正を拒否する", async () => {
    const past = Date.now() - (ACCESS_COOKIE_TTL_SECONDS + 10) * 1000;
    const expired = await issueAccessToken(SECRET, past);
    expect(await verifyAccessToken(SECRET, expired)).toBe(false);

    expect(await verifyAccessToken(SECRET, null)).toBe(false);
    expect(await verifyAccessToken(SECRET, "")).toBe(false);
    expect(await verifyAccessToken(SECRET, "v1.abc")).toBe(false);
    expect(await verifyAccessToken(SECRET, "v2.123.sig")).toBe(false);
    expect(await verifyAccessToken("", "v1.123.sig")).toBe(false);
  });

  it("ACCESS-005: トークンにアクセスコード平文を含まない", async () => {
    process.env.APP_ACCESS_CODE = "super-secret-code";
    const token = await issueAccessToken(SECRET);
    expect(token).not.toContain("super-secret-code");
    delete process.env.APP_ACCESS_CODE;
  });
});
