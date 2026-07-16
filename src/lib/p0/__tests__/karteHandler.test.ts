import { describe, expect, it } from "vitest";
import {
  handleKarteFeedback,
  handleKarteResult,
  type KarteDeps,
} from "../karteHandler";
import { InMemoryRunStore, type KarteInit, type RunSuccessMeta } from "../store";
import {
  ASSESSMENTS,
  FEEDBACK_RATINGS,
  INCORRECT_AREAS,
  TRADE_RESULTS,
} from "../types";
import { karteFeedbackSchema, karteResultSchema } from "../dto";
import { makeSnapshot, makeValidReview } from "./fixtures";

// 結果の後入力(§12)と構造化フィードバック(§13)。
// deps に Anthropic クライアントが存在しないため、これらの操作でAIが
// 再実行されないことは型レベルで保証される(RESULT-002)。

function makeKarteInit(userId = "user-a"): KarteInit {
  return {
    userId,
    tradeAt: "2026-07-15T09:30:00.000Z",
    tradeTimezone: "Asia/Tokyo",
    pair: "USD/JPY",
    direction: "long",
    playbookId: "pb-1",
    playbookSnapshot: makeSnapshot(),
    playbookCreatedForThisReview: false,
    playbookEditedForThisReview: false,
    entryReason: "サポート反発を確認したため",
    memorySource: "recorded_at_time",
    emotionPre: null,
    resultWordDetected: false,
    resultWarningOverridden: false,
    imageBlindConfirmed: true,
    blindIntegrity: "clean",
    revisionOf: null,
    review: makeValidReview(),
  };
}

const META: RunSuccessMeta = {
  stopReason: "end_turn",
  latencyMs: 100,
  inputTokens: 1000,
  outputTokens: 500,
  estimatedCostYen: 1,
  rawResponseText: "{}",
  parsedResponse: makeValidReview(),
};

async function seedKarte(store: InMemoryRunStore, userId = "user-a") {
  const { runId } = await store.createRunning({
    userId,
    modelId: "test-model",
    promptVersion: "v1",
    schemaVersion: "v1",
  });
  const { karteId } = await store.finalizeCanonical(
    runId,
    makeKarteInit(userId),
    META,
  );
  return karteId;
}

function makeDeps(opts: {
  store: InMemoryRunStore;
  userId?: string | null;
  access?: boolean;
}): KarteDeps {
  return {
    store: opts.store,
    getUserId: async () => (opts.userId === undefined ? "user-a" : opts.userId),
    verifyAccess: async () => opts.access ?? true,
  };
}

function post(path: string, body: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const RESULT_BODY = {
  result: "win",
  pnl_pips: 25.5,
  exit_reason: "目標価格に到達した",
};

describe("結果の後入力(§12 / RESULT-001〜003)", () => {
  it("RESULT-001: win/loss/breakeven と pips・exit_reason を保存する", async () => {
    const store = new InMemoryRunStore();
    const deps = makeDeps({ store });
    for (const result of TRADE_RESULTS) {
      const karteId = await seedKarte(store);
      const res = await handleKarteResult(
        deps,
        post(`/api/karte/${karteId}/result`, { ...RESULT_BODY, result }),
        karteId,
      );
      expect(res.status).toBe(200);
      const karte = store.kartes.find((k) => k.id === karteId);
      expect(karte?.result).toEqual({ ...RESULT_BODY, result });
    }
  });

  it("RESULT-001: pips・exit_reason は null を許容する", async () => {
    const store = new InMemoryRunStore();
    const karteId = await seedKarte(store);
    const res = await handleKarteResult(
      makeDeps({ store }),
      post(`/api/karte/${karteId}/result`, {
        result: "loss",
        pnl_pips: null,
        exit_reason: null,
      }),
      karteId,
    );
    expect(res.status).toBe(200);
  });

  it("RESULT-002: assessment不変・run増加なし(AI再実行なし)", async () => {
    const store = new InMemoryRunStore();
    const karteId = await seedKarte(store);
    const before = store.kartes.find((k) => k.id === karteId);
    const assessmentBefore = before?.review.assessment;
    const reviewSnapshot = JSON.stringify(before?.review);
    const runsBefore = store.runs.length;

    await handleKarteResult(
      makeDeps({ store }),
      post(`/api/karte/${karteId}/result`, RESULT_BODY),
      karteId,
    );

    const after = store.kartes.find((k) => k.id === karteId);
    expect(after?.review.assessment).toBe(assessmentBefore);
    expect(JSON.stringify(after?.review)).toBe(reviewSnapshot);
    expect(store.runs).toHaveLength(runsBefore);
  });

  it("RESULT-003: 結果入力だけでは新karteを作らない(revision非作成)", async () => {
    const store = new InMemoryRunStore();
    const karteId = await seedKarte(store);
    await handleKarteResult(
      makeDeps({ store }),
      post(`/api/karte/${karteId}/result`, RESULT_BODY),
      karteId,
    );
    expect(store.kartes).toHaveLength(1);
    expect(store.kartes[0].revisionOf).toBeNull();
  });

  it("DTO違反: assessment等の未知キーや不正resultは400", async () => {
    const store = new InMemoryRunStore();
    const karteId = await seedKarte(store);
    const deps = makeDeps({ store });
    const bad = [
      { ...RESULT_BODY, result: "profit" },
      { ...RESULT_BODY, assessment: "ruleok" },
      { result: "win" },
      { ...RESULT_BODY, pnl_pips: "25.5" },
    ];
    for (const body of bad) {
      const res = await handleKarteResult(
        deps,
        post(`/api/karte/${karteId}/result`, body),
        karteId,
      );
      expect(res.status).toBe(400);
    }
    expect(store.kartes[0].result).toBeNull();
  });

  it("所有者でないkarteへの結果入力は404", async () => {
    const store = new InMemoryRunStore();
    const karteId = await seedKarte(store, "user-a");
    const res = await handleKarteResult(
      makeDeps({ store, userId: "user-b" }),
      post(`/api/karte/${karteId}/result`, RESULT_BODY),
      karteId,
    );
    expect(res.status).toBe(404);
    expect(store.kartes[0].result).toBeNull();
  });

  it("アクセスCookieなしは403・セッションなしは401", async () => {
    const store = new InMemoryRunStore();
    const karteId = await seedKarte(store);
    const noCookie = await handleKarteResult(
      makeDeps({ store, access: false }),
      post(`/api/karte/${karteId}/result`, RESULT_BODY),
      karteId,
    );
    expect(noCookie.status).toBe(403);
    const noSession = await handleKarteResult(
      makeDeps({ store, userId: null }),
      post(`/api/karte/${karteId}/result`, RESULT_BODY),
      karteId,
    );
    expect(noSession.status).toBe(401);
  });
});

describe("構造化フィードバック(§13 / FB-001〜004)", () => {
  it("FB-001: helpful を保存する", async () => {
    const store = new InMemoryRunStore();
    const karteId = await seedKarte(store);
    const body = {
      rating: "helpful",
      incorrect_areas: [],
      corrected_assessment: null,
      comment: null,
    };
    const res = await handleKarteFeedback(
      makeDeps({ store }),
      post(`/api/karte/${karteId}/feedback`, body),
      karteId,
    );
    expect(res.status).toBe(200);
    expect(store.kartes[0].feedback).toEqual(body);
  });

  it("FB-002: partial+複数incorrect_area+corrected_assessment+comment", async () => {
    const store = new InMemoryRunStore();
    const karteId = await seedKarte(store);
    const body = {
      rating: "partial",
      incorrect_areas: ["chart_reading", "behavior_signal"],
      corrected_assessment: "insufficient",
      comment: "サポート帯の読み取りが実際の水準とずれている",
    };
    const res = await handleKarteFeedback(
      makeDeps({ store }),
      post(`/api/karte/${karteId}/feedback`, body),
      karteId,
    );
    expect(res.status).toBe(200);
    expect(store.kartes[0].feedback).toEqual(body);
  });

  it("FB-003: 不正なincorrect_area・rating・訂正判定はZodで拒否", async () => {
    const store = new InMemoryRunStore();
    const karteId = await seedKarte(store);
    const deps = makeDeps({ store });
    const bad = [
      { rating: "helpful", incorrect_areas: ["typo_area"], corrected_assessment: null, comment: null },
      { rating: "great", incorrect_areas: [], corrected_assessment: null, comment: null },
      { rating: "partial", incorrect_areas: [], corrected_assessment: "great", comment: null },
      { rating: "partial", incorrect_areas: ["other", "other"], corrected_assessment: null, comment: null },
      { rating: "helpful", incorrect_areas: [], corrected_assessment: null, comment: null, extra: 1 },
    ];
    for (const body of bad) {
      const res = await handleKarteFeedback(
        deps,
        post(`/api/karte/${karteId}/feedback`, body),
        karteId,
      );
      expect(res.status).toBe(400);
    }
    expect(store.kartes[0].feedback).toBeNull();
  });

  it("FB-004: DTOのenumがTS内部キー定義と完全一致する", () => {
    expect(karteFeedbackSchema.shape.rating.options).toEqual([
      ...FEEDBACK_RATINGS,
    ]);
    expect(
      karteFeedbackSchema.shape.incorrect_areas.element.options,
    ).toEqual([...INCORRECT_AREAS]);
    expect(
      karteFeedbackSchema.shape.corrected_assessment.unwrap().options,
    ).toEqual([...ASSESSMENTS]);
    expect(karteResultSchema.shape.result.options).toEqual([...TRADE_RESULTS]);
  });

  it("所有者でないkarteへのフィードバックは404", async () => {
    const store = new InMemoryRunStore();
    const karteId = await seedKarte(store, "user-a");
    const res = await handleKarteFeedback(
      makeDeps({ store, userId: "user-b" }),
      post(`/api/karte/${karteId}/feedback`, {
        rating: "helpful",
        incorrect_areas: [],
        corrected_assessment: null,
        comment: null,
      }),
      karteId,
    );
    expect(res.status).toBe(404);
  });
});
