import { Fragment, useCallback, useEffect, useState } from "react";

import {
  DIFFICULTY_PREFIX,
  GENESIS_PREV_HASH,
  blockPayload,
  mineBlock,
  sha256,
} from "../lib/hash";
import { shortHash } from "../lib/format";
import type { LabBlock } from "../lib/types";
import { SectionHeading } from "./SectionHeading";

type Busy = "init" | "mining" | "repair" | null;

async function buildInitialChain(): Promise<LabBlock[]> {
  const now = Date.now();
  const items = [
    { data: "创世区块 · ChainLab", at: now - 30_000 },
    { data: "Alice → Bob：10 ETH", at: now - 20_000 },
    { data: "一笔交易被打包，链又长高一块", at: now - 10_000 },
  ];

  const blocks: LabBlock[] = [];

  for (let i = 0; i < items.length; i++) {
    const prevHash = i === 0 ? GENESIS_PREV_HASH : blocks[i - 1].hash;
    const base = {
      index: i,
      timestamp: items[i].at,
      data: items[i].data,
      prevHash,
      nonce: 0,
    };
    const mined = await mineBlock(base);
    blocks.push({ ...base, ...mined });
  }

  return blocks;
}

const LEARNINGS = [
  {
    title: "哈希指纹",
    body: "区块内容只要变一个字符，SHA-256 哈希就会完全不同。",
  },
  {
    title: "前哈希链接",
    body: "每个区块都保存上一个区块的哈希，像锁链一样首尾相连。",
  },
  {
    title: "工作量证明",
    body: `哈希必须以 “${DIFFICULTY_PREFIX}” 开头，需要不断调整 nonce 试出来。`,
  },
  {
    title: "篡改会级联",
    body: "改动一个区块，后面所有区块的校验都会跟着失效。",
  },
];

export function BlockchainLab() {
  const [blocks, setBlocks] = useState<LabBlock[] | null>(null);
  const [contentHashes, setContentHashes] = useState<string[]>([]);
  const [tampered, setTampered] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState<Busy>("init");
  const [notice, setNotice] = useState<string | null>(null);
  const [newData, setNewData] = useState("");
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState("");

  const loadInitial = useCallback(async () => {
    setBusy("init");
    setNotice(null);
    setEditing(null);
    setTampered(new Set());
    try {
      setBlocks(await buildInitialChain());
    } finally {
      setBusy(null);
    }
  }, []);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  useEffect(() => {
    if (!blocks) {
      setContentHashes([]);
      return;
    }

    let cancelled = false;
    void Promise.all(blocks.map((block) => sha256(blockPayload(block)))).then(
      (hashes) => {
        if (!cancelled) setContentHashes(hashes);
      },
    );

    return () => {
      cancelled = true;
    };
  }, [blocks]);

  const validity: boolean[] = [];

  if (blocks) {
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      const integrity =
        !tampered.has(i) && block.hash.startsWith(DIFFICULTY_PREFIX);
      const linked =
        i === 0
          ? block.prevHash === GENESIS_PREV_HASH
          : block.prevHash === blocks[i - 1].hash;
      const previousValid = i === 0 ? true : validity[i - 1];
      validity.push(integrity && linked && previousValid);
    }
  }

  const chainValid = blocks !== null && validity.every(Boolean);
  const firstInvalid = validity.findIndex((value) => !value);

  const addBlock = async () => {
    const value = newData.trim();
    if (!blocks || !value || busy) return;

    setBusy("mining");
    setNotice(null);

    try {
      const previous = blocks[blocks.length - 1];
      const base = {
        index: previous.index + 1,
        timestamp: Date.now(),
        data: value,
        prevHash: previous.hash,
        nonce: 0,
      };
      const mined = await mineBlock(base);

      setBlocks([...blocks, { ...base, ...mined }]);
      setNewData("");
      setNotice(
        `区块 #${base.index} 挖矿成功：哈希以 “${DIFFICULTY_PREFIX}” 开头。`,
      );
    } finally {
      setBusy(null);
    }
  };

  const saveTamper = (index: number) => {
    if (!blocks) return;

    const value = draft.trim();
    if (!value || value === blocks[index].data) {
      setEditing(null);
      return;
    }

    setBlocks(
      blocks.map((block, i) => (i === index ? { ...block, data: value } : block)),
    );
    setTampered((previous) => new Set(previous).add(index));
    setEditing(null);
    setDraft("");
    setNotice(
      `区块 #${index} 的数据被改了，但记录的哈希没有重新计算。整条链从它开始失效。`,
    );
  };

  const repairChain = async () => {
    if (!blocks || busy || firstInvalid < 0) return;

    setBusy("repair");
    setNotice(null);

    try {
      const next = blocks.map((block) => ({ ...block }));
      let remined = 0;

      for (let i = firstInvalid; i < next.length; i++) {
        const prevHash = i === 0 ? GENESIS_PREV_HASH : next[i - 1].hash;
        const mined = await mineBlock({ ...next[i], prevHash, nonce: 0 });
        next[i] = { ...next[i], prevHash, ...mined };
        remined++;
        setBlocks([...next]);
      }

      setTampered(new Set());
      setNotice(
        `修复完成：重新挖了 ${remined} 个区块。篡改越靠前，需要重做的计算就越多。`,
      );
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="section container" id="lab">
      <SectionHeading
        eyebrow="Step 00 · 先建立直觉"
        title="亲手篡改一条区块链"
        description="下面这条链完全运行在你的浏览器里。试着改掉某个区块的数据，看看哈希校验如何发现它。"
      />

      <div className="card lab-card">
        <div className={`lab-status ${chainValid ? "ok" : "bad"}`}>
          <span className="status-dot" />
          <span>
            {blocks === null
              ? "正在生成区块…"
              : chainValid
                ? "链完整：所有哈希与前哈希都能对上。"
                : `链已损坏：从区块 #${firstInvalid} 开始校验失败。`}
          </span>
          {!chainValid && firstInvalid >= 0 ? (
            <button
              className="btn btn-small btn-primary lab-repair"
              onClick={() => void repairChain()}
              disabled={busy !== null}
            >
              {busy === "repair" ? "重新挖矿中…" : "修复整条链"}
            </button>
          ) : null}
        </div>

        <div className="lab-toolbar">
          <form
            className="lab-form"
            onSubmit={(event) => {
              event.preventDefault();
              void addBlock();
            }}
          >
            <input
              value={newData}
              onChange={(event) => setNewData(event.target.value)}
              placeholder="输入新区块的数据，例如：Bob → Carol：2 ETH"
              maxLength={80}
              disabled={busy !== null}
              aria-label="新区块数据"
            />
            <button
              className="btn btn-primary"
              type="submit"
              disabled={busy !== null || newData.trim().length === 0}
            >
              {busy === "mining" ? "挖矿中…" : "挖出新块"}
            </button>
          </form>

          <button
            className="btn btn-ghost"
            onClick={() => void loadInitial()}
            disabled={busy !== null}
          >
            重置演示
          </button>
        </div>

        <div className="chain-scroll">
          {blocks === null ? (
            <p className="muted">正在用 Web Crypto 计算哈希…</p>
          ) : (
            blocks.map((block, index) => {
              const valid = validity[index];
              const recomputed = contentHashes[index];
              const mismatch =
                recomputed !== undefined && recomputed !== block.hash;

              return (
                <Fragment key={block.index}>
                  {index > 0 ? (
                    <div
                      className="chain-arrow"
                      data-broken={valid ? "false" : "true"}
                      aria-hidden="true"
                    >
                      →
                    </div>
                  ) : null}

                  <article className={`block-card ${valid ? "valid" : "invalid"}`}>
                    <header className="block-head">
                      <span className="block-index">区块 #{block.index}</span>
                      <span className={`badge ${valid ? "ok" : "bad"}`}>
                        {valid ? "校验通过" : "校验失败"}
                      </span>
                    </header>

                    {editing === index ? (
                      <div className="block-edit">
                        <input
                          value={draft}
                          onChange={(event) => setDraft(event.target.value)}
                          maxLength={80}
                          autoFocus
                          aria-label={`修改区块 ${index} 的数据`}
                        />
                        <div className="block-edit-actions">
                          <button
                            className="btn btn-small btn-primary"
                            onClick={() => saveTamper(index)}
                          >
                            保存篡改
                          </button>
                          <button
                            className="btn btn-small btn-ghost"
                            onClick={() => setEditing(null)}
                          >
                            取消
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="block-data">{block.data}</p>
                    )}

                    <dl className="block-meta">
                      <div>
                        <dt>nonce</dt>
                        <dd>{block.nonce}</dd>
                      </div>
                      <div>
                        <dt>prev</dt>
                        <dd title={block.prevHash}>
                          {shortHash(block.prevHash)}
                        </dd>
                      </div>
                      <div>
                        <dt>hash</dt>
                        <dd title={block.hash}>{shortHash(block.hash)}</dd>
                      </div>
                      <div>
                        <dt>当前内容哈希</dt>
                        <dd
                          title={recomputed}
                          className={mismatch ? "mismatch" : ""}
                        >
                          {recomputed ? shortHash(recomputed) : "计算中…"}
                        </dd>
                      </div>
                    </dl>

                    <div className="block-actions">
                      <button
                        className="btn btn-small btn-ghost"
                        onClick={() => {
                          setEditing(index);
                          setDraft(block.data);
                        }}
                        disabled={busy !== null}
                      >
                        篡改数据
                      </button>
                      <span className="block-timestamp">
                        {new Date(block.timestamp).toLocaleTimeString("zh-CN")}
                      </span>
                    </div>
                  </article>
                </Fragment>
              );
            })
          )}
        </div>

        {notice ? <p className="lab-notice">{notice}</p> : null}
      </div>

      <div className="learn-grid">
        {LEARNINGS.map((item) => (
          <div className="learn-card" key={item.title}>
            <h3>{item.title}</h3>
            <p>{item.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
