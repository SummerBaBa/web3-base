import { Contract, type InterfaceAbi } from "ethers";
import { useCallback, useEffect, useState } from "react";

import type { WalletApi } from "../hooks/useWallet";
import { api } from "../lib/api";
import {
  addressColor,
  byteLength,
  errorMessage,
  formatTime,
  shortAddress,
  shortHash,
} from "../lib/format";
import type { ChainNote, DeploymentConfig, Stats } from "../lib/types";
import { SectionHeading } from "./SectionHeading";
import { TxFlow, type TxPhase } from "./TxFlow";

const MAX_BYTES = 280;

type Props = {
  wallet: WalletApi;
  config: DeploymentConfig | null;
};

type TxState = {
  phase: TxPhase;
  hash?: string;
  error?: string;
};

export function Guestbook({ wallet, config }: Props) {
  const [notes, setNotes] = useState<ChainNote[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [tx, setTx] = useState<TxState>({ phase: "idle" });

  const load = useCallback(async () => {
    try {
      const [notesResponse, statsResponse] = await Promise.all([
        api.notes(50),
        api.stats(),
      ]);
      setNotes(notesResponse.notes);
      setStats(statsResponse);
      setListError(null);
    } catch (error) {
      setListError(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      void load();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [load]);

  const bytes = byteLength(content);
  const tooLong = bytes > MAX_BYTES;
  const submitting = tx.phase === "signing" || tx.phase === "pending";

  const submit = async () => {
    const text = content.trim();

    if (!text || tooLong || submitting) return;

    if (!config) {
      setTx({ phase: "error", error: "合约还没部署好，请等待启动完成。" });
      return;
    }

    if (!wallet.address) {
      setTx({ phase: "error", error: "请先在上方连接钱包。" });
      return;
    }

    setTx({ phase: "signing" });

    try {
      const signer = await wallet.getSigner();
      const contract = new Contract(
        config.address,
        config.abi as InterfaceAbi,
        signer,
      );

      const response = await contract.createNote(text);
      setTx({ phase: "pending", hash: response.hash });

      await response.wait();
      setTx({ phase: "confirmed", hash: response.hash });
      setContent("");

      await new Promise((resolve) => window.setTimeout(resolve, 700));
      await load();
    } catch (error) {
      setTx({ phase: "error", error: errorMessage(error) });
    }
  };

  return (
    <section className="section container" id="guestbook">
      <SectionHeading
        eyebrow="Step 02 · 真正写进链里"
        title="链上留言板"
        description="点击发送后，钱包会请求你签名。交易被打包进区块，合约发出 NoteCreated 事件，后端索引器再把事件同步到数据库。"
      />

      <div className="guestbook-grid">
        <div className="card compose-card">
          <div className="compose-head">
            <h3>写一条永久留言</h3>
            <span className="tag">合约调用 · createNote()</span>
          </div>

          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="例如：我刚刚完成了人生第一笔链上交易。"
            rows={5}
            disabled={submitting}
            aria-label="留言内容"
          />

          <div className="compose-foot">
            <span className={`byte-count ${tooLong ? "bad" : ""}`}>
              {bytes} / {MAX_BYTES} 字节
            </span>
            <button
              className="btn btn-primary"
              onClick={() => void submit()}
              disabled={
                submitting ||
                content.trim().length === 0 ||
                tooLong ||
                !config
              }
            >
              {submitting ? "处理中…" : "签名并上链"}
            </button>
          </div>

          {!wallet.address ? (
            <p className="hint-text">
              提示：先在上方连接钱包，才能发起交易。
            </p>
          ) : (
            <p className="hint-text">
              这笔交易会消耗本地测试 ETH 作为 gas，但不会产生任何真实费用。
            </p>
          )}

          {tooLong ? (
            <p className="error-text">
              内容超过 280 字节。一个中文字通常占 3 个字节，请精简一下。
            </p>
          ) : null}

          <TxFlow phase={tx.phase} hash={tx.hash} error={tx.error} />
        </div>

        <div className="card feed-card">
          <div className="feed-head">
            <div>
              <h3>链上动态</h3>
              <p className="muted small">
                数据来自后端索引器，监听合约的 NoteCreated 事件。
              </p>
            </div>
            <button
              className="btn btn-small btn-ghost"
              onClick={() => void load()}
            >
              刷新
            </button>
          </div>

          <div className="stats-row">
            <div className="stat">
              <span className="stat-value">{stats?.totalNotes ?? "—"}</span>
              <span className="stat-label">留言总数</span>
            </div>
            <div className="stat">
              <span className="stat-value">{stats?.uniqueAuthors ?? "—"}</span>
              <span className="stat-label">独立作者</span>
            </div>
            <div className="stat">
              <span className="stat-value">{stats?.latestBlock ?? "—"}</span>
              <span className="stat-label">最新区块</span>
            </div>
          </div>

          {listError ? <p className="error-text">{listError}</p> : null}

          <div className="notes-list">
            {loading && notes.length === 0 ? (
              <p className="muted">正在从索引器加载留言…</p>
            ) : null}

            {notes.map((note) => (
              <article className="note" key={`${note.txHash}-${note.id}`}>
                <div className="note-head">
                  <span
                    className="avatar"
                    style={{ background: addressColor(note.author) }}
                  />
                  <div className="note-meta">
                    <code>{shortAddress(note.author)}</code>
                    <span className="muted small">
                      {formatTime(note.createdAt)}
                    </span>
                  </div>
                  <span className="note-block">区块 #{note.blockNumber}</span>
                </div>

                <p className="note-content">{note.content}</p>

                <div className="note-foot">
                  <code title={note.txHash}>{shortHash(note.txHash)}</code>
                  <span className="tag">NoteCreated</span>
                </div>
              </article>
            ))}

            {!loading && notes.length === 0 && !listError ? (
              <p className="muted">
                还没有留言。连接钱包，写下第一条链上记录吧。
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
