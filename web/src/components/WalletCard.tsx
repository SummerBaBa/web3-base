import { useState } from "react";

import type { WalletApi } from "../hooks/useWallet";
import { addressColor, errorMessage, shortAddress } from "../lib/format";
import type { DeploymentConfig } from "../lib/types";
import { SectionHeading } from "./SectionHeading";

type Props = {
  wallet: WalletApi;
  config: DeploymentConfig | null;
};

const HARDHAT_TEST_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

export function WalletCard({ wallet, config }: Props) {
  const [actionError, setActionError] = useState<string | null>(null);
  const expectedChain = config?.chainId ?? 31337;
  const wrongNetwork =
    wallet.chainId !== null && wallet.chainId !== expectedChain;
  const hasWallet =
    typeof window !== "undefined" && Boolean(window.ethereum);

  const switchNetwork = async () => {
    setActionError(null);
    try {
      await wallet.ensureNetwork();
    } catch (error) {
      setActionError(errorMessage(error));
    }
  };

  return (
    <section className="section container" id="wallet">
      <SectionHeading
        eyebrow="Step 01 · 链上身份"
        title="连接钱包，而不是注册账号"
        description="Web3 没有用户名和密码。钱包保管私钥，并对每一笔交易签名；网站只能拿到你的地址和签名结果。"
      />

      <div className="wallet-grid">
        <div className="card wallet-card">
          {wallet.address ? (
            <>
              <div className="wallet-head">
                <span
                  className="avatar avatar-large"
                  style={{ background: addressColor(wallet.address) }}
                />
                <div className="wallet-identity">
                  <span className="wallet-address" title={wallet.address}>
                    {shortAddress(wallet.address)}
                  </span>
                  <span className="muted small">
                    已连接 {wallet.chainId ?? "—"} 号网络
                  </span>
                </div>
                <span className={`badge ${wrongNetwork ? "bad" : "ok"}`}>
                  {wrongNetwork ? "网络不匹配" : "已连接"}
                </span>
              </div>

              <dl className="wallet-meta">
                <div>
                  <dt>余额</dt>
                  <dd>{wallet.balance ?? "—"} ETH</dd>
                </div>
                <div>
                  <dt>Chain ID</dt>
                  <dd>{wallet.chainId ?? "—"}</dd>
                </div>
                <div>
                  <dt>合约地址</dt>
                  <dd title={config?.address}>
                    {config ? shortAddress(config.address) : "等待部署"}
                  </dd>
                </div>
              </dl>

              {wrongNetwork ? (
                <p className="warn-text">
                  当前钱包不在 ChainLab 本地链上，切换后才能写入留言。
                </p>
              ) : null}

              <div className="wallet-actions">
                {wrongNetwork ? (
                  <button
                    className="btn btn-primary"
                    onClick={() => void switchNetwork()}
                  >
                    切换到本地链
                  </button>
                ) : null}
                <button
                  className="btn btn-ghost"
                  onClick={() => void wallet.refresh()}
                >
                  刷新余额
                </button>
                <button className="btn btn-ghost" onClick={wallet.disconnect}>
                  断开连接
                </button>
              </div>
            </>
          ) : (
            <div className="wallet-empty">
              <span className="wallet-empty-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                  <rect x="3" y="6" width="18" height="13" rx="3" />
                  <path d="M3 10h18" />
                  <circle cx="16.5" cy="14.5" r="1.2" fill="currentColor" stroke="none" />
                </svg>
              </span>
              <p className="wallet-empty-title">还没有连接钱包</p>
              <p className="muted">
                连接后可以查看余额，并在下一页把留言真正写入区块链。
              </p>
              <button
                className="btn btn-primary"
                disabled={wallet.connecting}
                onClick={() => void wallet.connect()}
              >
                {wallet.connecting
                  ? "正在连接…"
                  : hasWallet
                    ? "连接 MetaMask"
                    : "未检测到钱包"}
              </button>
              {!hasWallet ? (
                <p className="error-text">
                  请先安装 MetaMask 浏览器插件，然后刷新页面。
                </p>
              ) : null}
            </div>
          )}

          {wallet.error ? <p className="error-text">{wallet.error}</p> : null}
          {actionError ? <p className="error-text">{actionError}</p> : null}
        </div>

        <div className="card setup-card">
          <h3>把本地链接进钱包</h3>
          <p className="muted">
            项目启动后，Hardhat 会在本机运行一条测试链。把下面的参数填进
            MetaMask 即可。
          </p>

          <ul className="kv-list">
            <li>
              <span>RPC URL</span>
              <code>http://127.0.0.1:8545</code>
            </li>
            <li>
              <span>Chain ID</span>
              <code>31337</code>
            </li>
            <li>
              <span>货币符号</span>
              <code>ETH</code>
            </li>
          </ul>

          <details className="setup-details">
            <summary>如何获得测试 ETH？</summary>
            <p className="muted">
              Hardhat 默认账户 #0 自带 10000 测试 ETH。仅限本地开发使用。
            </p>
            <code className="private-key">{HARDHAT_TEST_KEY}</code>
            <p className="muted small">
              MetaMask → 账户 → 导入账户 → 粘贴私钥。永远不要把真实私钥交给任何网站。
            </p>
          </details>
        </div>
      </div>
    </section>
  );
}
