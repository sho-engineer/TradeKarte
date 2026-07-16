import { describe, expect, it } from "vitest";
import type { AnthropicLike } from "../anthropic";
import { handleReview, type ReviewDeps } from "../reviewHandler";
import { InMemoryRunStore } from "../store";
import { makeBody } from "./dto.test";
import { makeValidReview } from "./fixtures";

type FakeResponse = Awaited<
  ReturnType<AnthropicLike["messages"]["create"]>
>;

function okResponse(overrides: Partial<FakeResponse> = {}): FakeResponse {
  return {
    content: [{ type: "text", text: JSON.stringify(makeValidReview()) }],
    stop_reason: "end_turn",
    model: "test-model",
    usage: { input_tokens: 1000, output_tokens: 500 },
    ...overrides,
  };
}

function makeDeps(opts: {
  store?: InMemoryRunStore;
  userId?: string | null;
  access?: boolean;
  response?: FakeResponse | Error;
  onPayload?: (p: unknown) => void;
}) {
  const store = opts.store ?? new InMemoryRunStore();
  let calls = 0;
  const client: AnthropicLike = {
    messages: {
      async create(params) {
        calls += 1;
        opts.onPayload?.(params);
        const r = opts.response ?? okResponse();
        if (r instanceof Error) throw r;
        return r;
      },
    },
  };
  const deps: ReviewDeps = {
    store,
    getUserId: async () => (opts.userId === undefined ? "user-a" : opts.userId),
    client,
    model: "test-model",
    verifyAccess: async () => opts.access ?? true,
  };
  return { deps, store, getCalls: () => calls };
}

function post(body: unknown): Request {
  return new Request("http://localhost/api/review", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/review(§10.2 / 必須テスト8・14章)", () => {
  it("RUN-001/002: 初回成功で run=succeeded・karte 1件・canonical=true", async () => {
    const { deps, store } = makeDeps({});
    const res = await handleReview(deps, post(makeBody()));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.is_canonical).toBe(true);
    expect(json.karte_id).toBeTruthy();
    expect(json.review.assessment).toBe("ruleok");

    expect(store.kartes).toHaveLength(1);
    expect(store.runs).toHaveLength(1);
    const run = store.runs[0];
    expect(run.status).toBe("succeeded");
    expect(run.karteId).toBe(json.karte_id);
    expect(run.isCanonical).toBe(true);
    expect(run.userId).toBe("user-a"); // セッション由来(AUTH-002)
    expect(run.init.modelId).toBe("test-model");
    expect(run.init.promptVersion).toBeTruthy();
    expect(run.init.schemaVersion).toBeTruthy();
  });

  it("RUN-009/IMG-009: karte・run のどこにも画像が保存されない", async () => {
    const { deps, store } = makeDeps({});
    await handleReview(deps, post(makeBody()));
    const dump = JSON.stringify({ runs: store.runs, kartes: store.kartes });
    expect(dump).not.toContain("data:image");
    expect(dump).not.toContain("base64,");
  });

  it("ACCESS-004: アクセスCookieなしは403・Anthropic非実行・run非作成", async () => {
    const { deps, store, getCalls } = makeDeps({ access: false });
    const res = await handleReview(deps, post(makeBody()));
    expect(res.status).toBe(403);
    expect(getCalls()).toBe(0);
    expect(store.runs).toHaveLength(0);
  });

  it("AI-REQ-005相当: 未認証は401", async () => {
    const { deps, store, getCalls } = makeDeps({ userId: null });
    const res = await handleReview(deps, post(makeBody()));
    expect(res.status).toBe(401);
    expect(getCalls()).toBe(0);
    expect(store.runs).toHaveLength(0);
  });

  it("DTO違反(resultキー)は400・run非作成", async () => {
    const { deps, store, getCalls } = makeDeps({});
    const res = await handleReview(
      deps,
      post({ ...makeBody(), result: "win" }),
    );
    expect(res.status).toBe(400);
    expect(getCalls()).toBe(0);
    expect(store.runs).toHaveLength(0);
  });

  it("RUN-003/AI-OUT-017: refusal は run=failed(stage=refusal)・karte 0件", async () => {
    const { deps, store } = makeDeps({
      response: okResponse({ stop_reason: "refusal", content: [] }),
    });
    const res = await handleReview(deps, post(makeBody()));
    expect(res.status).toBe(502);
    const json = await res.json();
    expect(json.failure_stage).toBe("refusal");
    expect(json.retryable).toBe(true);
    expect(store.kartes).toHaveLength(0);
    expect(store.runs[0].status).toBe("failed");
    expect(store.runs[0].failure?.stage).toBe("refusal");
  });

  it("AI-OUT-018: max_tokens は failure_stage=max_tokens・karte 0件", async () => {
    const { deps, store } = makeDeps({
      response: okResponse({ stop_reason: "max_tokens" }),
    });
    const res = await handleReview(deps, post(makeBody()));
    expect(res.status).toBe(502);
    expect(store.runs[0].failure?.stage).toBe("max_tokens");
    expect(store.kartes).toHaveLength(0);
  });

  it("AI-OUT-019: HTTPエラーは http_status を保存・karte 0件", async () => {
    const err = Object.assign(new Error("overloaded"), { status: 529 });
    const { deps, store } = makeDeps({ response: err });
    const res = await handleReview(deps, post(makeBody()));
    expect(res.status).toBe(502);
    expect(store.runs[0].failure?.stage).toBe("anthropic_http");
    expect(store.runs[0].failure?.httpStatus).toBe(529);
    expect(store.kartes).toHaveLength(0);
  });

  it("RUN-004: JSONパース不能は structured_output・karte 0件", async () => {
    const { deps, store } = makeDeps({
      response: okResponse({ content: [{ type: "text", text: "not-json{" }] }),
    });
    await handleReview(deps, post(makeBody()));
    expect(store.runs[0].failure?.stage).toBe("structured_output");
    expect(store.kartes).toHaveLength(0);
  });

  it("SCHEMA-002: assessment未知値は zod_validation・karte 0件", async () => {
    const bad = { ...makeValidReview(), assessment: "great" };
    const { deps, store } = makeDeps({
      response: okResponse({
        content: [{ type: "text", text: JSON.stringify(bad) }],
      }),
    });
    const res = await handleReview(deps, post(makeBody()));
    expect(res.status).toBe(502);
    expect(store.runs[0].failure?.stage).toBe("zod_validation");
    expect(store.kartes).toHaveLength(0);
  });

  it("RUN-005: 再実行は新karteを作らず non-canonical run を関連付ける", async () => {
    const store = new InMemoryRunStore();
    const first = makeDeps({ store });
    const res1 = await handleReview(first.deps, post(makeBody()));
    const { karte_id } = await res1.json();

    const second = makeDeps({ store });
    const res2 = await handleReview(
      second.deps,
      post({ ...makeBody(), rerun_of_karte_id: karte_id, experiment_id: "exp-1" }),
    );
    expect(res2.status).toBe(200);
    const json2 = await res2.json();
    expect(json2.is_canonical).toBe(false);
    expect(json2.karte_id).toBe(karte_id);

    // RUN-006: karte件数は増えない・experiment_idが記録される
    expect(store.kartes).toHaveLength(1);
    expect(store.runs).toHaveLength(2);
    expect(store.runs[1].isCanonical).toBe(false);
    expect(store.runs[1].karteId).toBe(karte_id);
    expect(store.runs[1].init.experimentId).toBe("exp-1");
  });

  it("REV-003: 他人のkarteをrerun/revision元に指定できない", async () => {
    const store = new InMemoryRunStore();
    const owner = makeDeps({ store });
    const res1 = await handleReview(owner.deps, post(makeBody()));
    const { karte_id } = await res1.json();

    const attacker = makeDeps({ store, userId: "user-b" });
    const res2 = await handleReview(
      attacker.deps,
      post({ ...makeBody(), rerun_of_karte_id: karte_id }),
    );
    expect(res2.status).toBe(404);
    const res3 = await handleReview(
      attacker.deps,
      post({ ...makeBody(), revision_of: karte_id }),
    );
    expect(res3.status).toBe(404);
  });

  it("REV-001: 入力訂正は新karte+新canonical run・元karte不変", async () => {
    const store = new InMemoryRunStore();
    const first = makeDeps({ store });
    const res1 = await handleReview(first.deps, post(makeBody()));
    const { karte_id: originalId } = await res1.json();
    const originalSnapshot = JSON.stringify(
      store.kartes.find((k) => k.id === originalId),
    );

    const second = makeDeps({ store });
    const res2 = await handleReview(
      second.deps,
      post({ ...makeBody(), revision_of: originalId, pair: "EUR/USD" }),
    );
    expect(res2.status).toBe(200);
    const json2 = await res2.json();
    expect(json2.karte_id).not.toBe(originalId);
    expect(json2.is_canonical).toBe(true);

    const revised = store.kartes.find((k) => k.id === json2.karte_id);
    expect(revised?.revisionOf).toBe(originalId);
    // 元カルテは変更されない
    expect(
      JSON.stringify(store.kartes.find((k) => k.id === originalId)),
    ).toBe(originalSnapshot);
  });

  it("RATE-001/002: 5回まで許可・6回目は429でrun非作成・Anthropic非実行", async () => {
    const store = new InMemoryRunStore();
    for (let i = 0; i < 5; i++) {
      const { deps } = makeDeps({ store });
      const res = await handleReview(deps, post(makeBody()));
      expect(res.status).toBe(200);
    }
    const sixth = makeDeps({ store });
    const res = await handleReview(sixth.deps, post(makeBody()));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("60");
    expect(sixth.getCalls()).toBe(0);
    expect(store.runs).toHaveLength(5);
  });

  it("RATE-003: ユーザーAの制限がユーザーBへ影響しない", async () => {
    const store = new InMemoryRunStore();
    for (let i = 0; i < 5; i++) {
      const { deps } = makeDeps({ store });
      await handleReview(deps, post(makeBody()));
    }
    const userB = makeDeps({ store, userId: "user-b" });
    const res = await handleReview(userB.deps, post(makeBody()));
    expect(res.status).toBe(200);
  });

  it("handler経由でも感情・結果がAI payloadへ渡らない(FORM-005)", async () => {
    let captured = "";
    const { deps } = makeDeps({
      onPayload: (p) => {
        captured = JSON.stringify(p);
      },
    });
    await handleReview(
      deps,
      post({ ...makeBody(), emotion_pre: "rushed" }),
    );
    expect(captured).not.toContain("emotion");
    expect(captured).not.toContain("rushed");
    expect(captured).not.toContain("user-a");
    expect(captured).not.toContain("recorded_at_time");
  });
});
