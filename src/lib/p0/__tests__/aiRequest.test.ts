import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildReviewPayload } from "../anthropic";
import { SYSTEM_PROMPT, type ReviewPromptInput } from "../prompt";
import { makeRules, TINY_JPEG_DATA_URL } from "./fixtures";

function makeInput(): ReviewPromptInput {
  return {
    croppedImageDataUrl: TINY_JPEG_DATA_URL,
    pair: "USD/JPY",
    direction: "long",
    rules: makeRules(),
    entryReason: "サポート到達後の反発を確認してエントリー",
  };
}

describe("AIリクエスト(必須テスト6章)", () => {
  it("AI-REQ-001: 許可フィールドのみで構成される", () => {
    const payload = buildReviewPayload(makeInput(), "test-model");
    expect(Object.keys(payload).sort()).toEqual(
      ["max_tokens", "messages", "model", "output_config", "system"].sort(),
    );
    expect(payload.messages).toHaveLength(1);
    const content = payload.messages[0].content;
    expect(content.map((c) => c.type)).toEqual(["image", "text"]);
    const text = (content[1] as { text: string }).text;
    expect(text).toContain("USD/JPY");
    expect(text).toContain("long");
    expect(text).toContain("must_1");
    expect(text).toContain("エントリー理由");
  });

  it("AI-REQ-002: 結果系フィールドがpayloadへ混入しない", () => {
    // 入力オブジェクトに結果系の値を「存在させて」もpayloadへ出ないこと
    const dirty = {
      ...makeInput(),
      result: "win",
      pnl_pips: 123.5,
      exit_reason: "目標到達で利確できた",
    } as unknown as ReviewPromptInput;
    const json = JSON.stringify(buildReviewPayload(dirty, "test-model"));
    expect(json).not.toContain("result");
    expect(json).not.toContain("pnl_pips");
    expect(json).not.toContain("exit_reason");
    expect(json).not.toContain("win");
    expect(json).not.toContain("123.5");
    expect(json).not.toContain("利確できた");
  });

  it("AI-REQ-003: 感情がpayloadへ混入しない", () => {
    const dirty = {
      ...makeInput(),
      emotion_pre: "rushed",
      emotionLabel: "焦り",
    } as unknown as ReviewPromptInput;
    const payload = buildReviewPayload(dirty, "test-model");
    const json = JSON.stringify(payload);
    expect(json).not.toContain("emotion");
    expect(json).not.toContain("rushed");
    // 「焦り」はSystem Prompt本文(§7の禁止例)に正当に含まれるため、
    // ユーザー入力テキスト側に混入していないことを検査する
    const userText = (payload.messages[0].content[1] as { text: string }).text;
    expect(userText).not.toContain("焦り");
    expect(userText).not.toContain("冷静");
    expect(userText).not.toContain("感情");
  });

  it("AI-REQ-004: user_idがpayloadへ混入しない", () => {
    const dirty = {
      ...makeInput(),
      user_id: "attacker-user-id-0001",
    } as unknown as ReviewPromptInput;
    const json = JSON.stringify(buildReviewPayload(dirty, "test-model"));
    expect(json).not.toContain("user_id");
    expect(json).not.toContain("attacker-user-id-0001");
  });

  it("AI-REQ-005: クロップ済み画像のみを送る", () => {
    const dirty = {
      ...makeInput(),
      originalImageDataUrl: "data:image/jpeg;base64,ORIGINALORIGINAL",
    } as unknown as ReviewPromptInput;
    const payload = buildReviewPayload(dirty, "test-model");
    const images = payload.messages[0].content.filter(
      (c) => c.type === "image",
    );
    expect(images).toHaveLength(1);
    expect(JSON.stringify(payload)).not.toContain("ORIGINALORIGINAL");
  });

  it("AI-REQ-005: JPEG data URL以外の画像を拒否する", () => {
    const png = { ...makeInput(), croppedImageDataUrl: "data:image/png;base64,AAAA" };
    expect(() => buildReviewPayload(png, "test-model")).toThrow();
    const raw = { ...makeInput(), croppedImageDataUrl: "not-a-data-url" };
    expect(() => buildReviewPayload(raw, "test-model")).toThrow();
  });

  it("AI-REQ-006: System Promptが設計書§7と文字列一致する", () => {
    const doc = readFileSync(
      join(process.cwd(), "docs", "ポジミル_機能設計書_v3.3.md"),
      "utf8",
    );
    const section = doc.split("## 7. AIレビュー：確定System Prompt")[1];
    expect(section).toBeTruthy();
    const m = /```text\n([\s\S]*?)\n```/.exec(section);
    expect(m).toBeTruthy();
    expect(SYSTEM_PROMPT).toBe(m![1]);

    const payload = buildReviewPayload(makeInput(), "test-model");
    expect(payload.system).toBe(SYSTEM_PROMPT);
  });

  it("AI-REQ-007: Structured Outputsは現行形(output_config.format)", () => {
    const payload = buildReviewPayload(makeInput(), "test-model");
    expect(payload.output_config.format.type).toBe("json_schema");
    expect(payload.output_config.format.schema).toBeTruthy();
    const json = JSON.stringify(payload);
    expect(json).not.toContain('"output_format"');
    // モデルIDは引数(env由来)のみ。直書きされた既定値がないこと
    expect(payload.model).toBe("test-model");
  });
});
