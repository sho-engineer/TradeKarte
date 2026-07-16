import type { ReviewRequest } from "./dto";
import type {
  BlindIntegrity,
  FailureStage,
  KarteFeedbackInput,
  KarteResultInput,
  ReviewOutput,
} from "./types";

// ai_review_run / karte の永続化抽象(機能設計書 v3.3 §10)。
// レート制限も全実行が記録される ai_review_run のカウントで行う(§15)。
//
// ⚠ Supabase 実装は docs/ポジミル_supabase_phase0.sql(未受領)の列名・
//   RPC(finalize_ai_review_run)が正本のため、SQL受領後に結線する。
//   それまでは InMemoryRunStore(開発・テスト用)を使用する。

export interface RunInit {
  userId: string;
  modelId: string;
  promptVersion: string;
  schemaVersion: string;
  experimentId?: string;
}

export interface RunFailure {
  stage: FailureStage;
  message: string;
  httpStatus?: number;
  stopReason?: string;
  latencyMs?: number;
  /** レスポンス本文のみ。画像・APIキー・リクエスト本文を含めない(§10.4) */
  rawResponseText?: string;
}

export interface RunSuccessMeta {
  stopReason: string;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostYen: number;
  rawResponseText: string;
  parsedResponse: ReviewOutput;
}

/** karte へ保存する確定監査結果+入力(画像は含まない: REG-001) */
export interface KarteInit {
  userId: string;
  tradeAt: string;
  tradeTimezone: string;
  pair: string;
  direction: ReviewRequest["direction"];
  playbookId: string;
  playbookSnapshot: ReviewRequest["playbook_snapshot"];
  playbookCreatedForThisReview: boolean;
  playbookEditedForThisReview: boolean;
  entryReason: string;
  memorySource: ReviewRequest["memory_source"];
  emotionPre: ReviewRequest["emotion_pre"] | null;
  resultWordDetected: boolean;
  resultWarningOverridden: boolean;
  imageBlindConfirmed: true;
  blindIntegrity: BlindIntegrity;
  revisionOf: string | null;
  review: ReviewOutput;
}

export interface RunStore {
  /** 直近 windowSeconds 秒間の run 件数(レート制限用・作成前に確認) */
  countRecentRuns(userId: string, windowSeconds: number): Promise<number>;
  /** run を running / karte_id=null で作成(§10.2-4) */
  createRunning(init: RunInit): Promise<{ runId: string }>;
  /** 失敗: run を failed へ更新。karte は作らない(§10.2-7) */
  markFailed(runId: string, failure: RunFailure): Promise<void>;
  /**
   * 初回成功: karte作成とrun確定を同一トランザクションで行う
   * (SQLの finalize_ai_review_run RPC 相当)。is_canonical=true
   */
  finalizeCanonical(
    runId: string,
    karte: KarteInit,
    meta: RunSuccessMeta,
  ): Promise<{ karteId: string }>;
  /** 再実行・モデル比較成功: 既存karteへ関連付け。is_canonical=false */
  attachNonCanonical(
    runId: string,
    karteId: string,
    meta: RunSuccessMeta,
  ): Promise<void>;
  /** karte の所有者確認(rerun / revision 元の検証: REV-003) */
  karteBelongsToUser(karteId: string, userId: string): Promise<boolean>;
  /**
   * 結果の後入力(§12)。結果列のみ更新し、assessment等の監査結果・runには
   * 触れない。false = 非所有または不存在
   */
  setResult(
    karteId: string,
    userId: string,
    result: KarteResultInput,
  ): Promise<boolean>;
  /** 構造化フィードバックの保存(§13)。false = 非所有または不存在 */
  setFeedback(
    karteId: string,
    userId: string,
    feedback: KarteFeedbackInput,
  ): Promise<boolean>;
}

// ---------------------------------------------------------------------------
// InMemoryRunStore: 開発・自動テスト用。
// 本番は SQL 受領後に Supabase service role 実装へ差し替える。

interface MemoryRun {
  id: string;
  userId: string;
  status: "running" | "succeeded" | "failed";
  karteId: string | null;
  isCanonical: boolean | null;
  createdAtMs: number;
  init: RunInit;
  failure?: RunFailure;
  meta?: RunSuccessMeta;
}

interface MemoryKarte extends KarteInit {
  id: string;
  result: KarteResultInput | null;
  feedback: KarteFeedbackInput | null;
}

export class InMemoryRunStore implements RunStore {
  runs: MemoryRun[] = [];
  kartes: MemoryKarte[] = [];
  private seq = 0;

  private nextId(prefix: string): string {
    this.seq += 1;
    return `${prefix}_${this.seq}`;
  }

  async countRecentRuns(userId: string, windowSeconds: number): Promise<number> {
    const since = Date.now() - windowSeconds * 1000;
    return this.runs.filter(
      (r) => r.userId === userId && r.createdAtMs >= since,
    ).length;
  }

  async createRunning(init: RunInit): Promise<{ runId: string }> {
    const run: MemoryRun = {
      id: this.nextId("run"),
      userId: init.userId,
      status: "running",
      karteId: null,
      isCanonical: null,
      createdAtMs: Date.now(),
      init,
    };
    this.runs.push(run);
    return { runId: run.id };
  }

  private getRun(runId: string): MemoryRun {
    const run = this.runs.find((r) => r.id === runId);
    if (!run) throw new Error(`run not found: ${runId}`);
    return run;
  }

  async markFailed(runId: string, failure: RunFailure): Promise<void> {
    const run = this.getRun(runId);
    run.status = "failed";
    run.failure = failure;
  }

  async finalizeCanonical(
    runId: string,
    karte: KarteInit,
    meta: RunSuccessMeta,
  ): Promise<{ karteId: string }> {
    const run = this.getRun(runId);
    // 1 karte に canonical run は1件だけ(RUN-007 相当のガード)
    const id = this.nextId("karte");
    this.kartes.push({ ...karte, id, result: null, feedback: null });
    run.status = "succeeded";
    run.karteId = id;
    run.isCanonical = true;
    run.meta = meta;
    return { karteId: id };
  }

  async attachNonCanonical(
    runId: string,
    karteId: string,
    meta: RunSuccessMeta,
  ): Promise<void> {
    const run = this.getRun(runId);
    run.status = "succeeded";
    run.karteId = karteId;
    run.isCanonical = false;
    run.meta = meta;
  }

  async karteBelongsToUser(karteId: string, userId: string): Promise<boolean> {
    return this.kartes.some((k) => k.id === karteId && k.userId === userId);
  }

  async setResult(
    karteId: string,
    userId: string,
    result: KarteResultInput,
  ): Promise<boolean> {
    const karte = this.kartes.find(
      (k) => k.id === karteId && k.userId === userId,
    );
    if (!karte) return false;
    karte.result = result;
    return true;
  }

  async setFeedback(
    karteId: string,
    userId: string,
    feedback: KarteFeedbackInput,
  ): Promise<boolean> {
    const karte = this.kartes.find(
      (k) => k.id === karteId && k.userId === userId,
    );
    if (!karte) return false;
    karte.feedback = feedback;
    return true;
  }
}

// 単一プロセス内のシングルトン(開発用)。
// TODO(SQL受領後): SupabaseRunStore を実装し、ここで環境に応じて返す。
let devStore: InMemoryRunStore | null = null;

export function getRunStore(): RunStore {
  if (!devStore) devStore = new InMemoryRunStore();
  return devStore;
}
