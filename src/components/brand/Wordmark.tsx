/** 「ポジミル」ワードマーク。「ミル」のみブランドカラー(teal)。 */
export default function Wordmark({ className }: { className?: string }) {
  return (
    <span className={className}>
      ポジ<span className="text-accent">ミル</span>
    </span>
  );
}
