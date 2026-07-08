import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "特定商取引法に基づく表記｜ポジミル",
};

const ROWS: { label: string; value: string }[] = [
  { label: "販売事業者", value: "課金開始前に確定" },
  { label: "運営責任者", value: "課金開始前に確定" },
  { label: "所在地", value: "課金開始前に確定（バーチャルオフィスを検討）" },
  { label: "連絡先", value: "課金開始前に確定（お問い合わせ窓口を設置）" },
  { label: "販売価格", value: "各プランのページに表示（税込）" },
  { label: "支払方法", value: "クレジットカード（Stripe）" },
  { label: "支払時期", value: "申込時に課金、以降は毎月自動更新" },
  { label: "サービス提供時期", value: "決済完了後、直ちに利用可能" },
  {
    label: "返品・キャンセル",
    value:
      "デジタルサービスの性質上、購入後の返金は原則不可。解約は次回更新日前までにお手続きください。",
  },
];

export default function TokushohoPage() {
  return (
    <>
      <h1>特定商取引法に基づく表記</h1>
      <p className="tk-legal__lead">
        本表記は、課金機能の提供開始前に確定します。以下は枠のみの下書きです。
      </p>

      <dl className="tk-legal__dl">
        {ROWS.map((r) => (
          <div key={r.label} className="tk-legal__row">
            <dt>{r.label}</dt>
            <dd>{r.value}</dd>
          </div>
        ))}
      </dl>

      <p className="tk-legal__note">
        ※ 個人事業として提供する場合の所在地・氏名の開示については、バーチャルオフィスの利用を含めて課金開始前に検討・確定します。
      </p>
    </>
  );
}
