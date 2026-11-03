import { shortHash } from "../lib/format";

export type TxPhase = "idle" | "signing" | "pending" | "confirmed" | "error";

type Props = {
  phase: TxPhase;
  hash?: string;
  error?: string;
};

const STEPS = [
  { title: "钱包签名", desc: "私钥留在钱包里" },
  { title: "广播交易", desc: "进入节点内存池" },
  { title: "打包上链", desc: "写入新的区块" },
  { title: "索引同步", desc: "后端监听事件" },
];

function stepState(
  index: number,
  phase: TxPhase,
): "done" | "active" | "todo" | "error" {
  if (phase === "error") return index === 0 ? "error" : "todo";
  if (phase === "confirmed") return "done";
  if (phase === "signing") return index === 0 ? "active" : "todo";
  if (phase === "pending") {
    if (index < 2) return "done";
    return index === 2 ? "active" : "todo";
  }
  return "todo";
}

export function TxFlow({ phase, hash, error }: Props) {
  if (phase === "idle") return null;

  return (
    <div className={`tx-flow ${phase}`}>
      <ol className="tx-steps">
        {STEPS.map((step, index) => (
          <li key={step.title} data-state={stepState(index, phase)}>
            <span className="tx-dot" aria-hidden="true" />
            <span className="tx-step-title">{step.title}</span>
            <span className="tx-step-desc">{step.desc}</span>
          </li>
        ))}
      </ol>

      {hash ? (
        <p className="tx-hash">
          交易哈希 <code title={hash}>{shortHash(hash)}</code>
        </p>
      ) : null}

      {phase === "signing" ? (
        <p className="tx-message">请在钱包弹窗中确认这笔交易…</p>
      ) : null}

      {phase === "confirmed" ? (
        <p className="tx-message ok">交易已上链，索引器正在同步。</p>
      ) : null}

      {phase === "error" ? <p className="error-text">{error}</p> : null}
    </div>
  );
}
