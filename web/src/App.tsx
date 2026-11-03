import { useEffect, useState } from "react";

import { Architecture } from "./components/Architecture";
import { BlockchainLab } from "./components/BlockchainLab";
import { Guestbook } from "./components/Guestbook";
import { Header } from "./components/Header";
import { Hero } from "./components/Hero";
import { WalletCard } from "./components/WalletCard";
import { useWallet } from "./hooks/useWallet";
import { api } from "./lib/api";
import { errorMessage } from "./lib/format";
import type { DeploymentConfig } from "./lib/types";

export default function App() {
  const [config, setConfig] = useState<DeploymentConfig | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const wallet = useWallet(config?.chainId ?? 31337);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    const loadConfig = async () => {
      try {
        const value = await api.config();
        if (!cancelled) {
          setConfig(value);
          setConfigError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setConfigError(errorMessage(error));
          timer = window.setTimeout(() => {
            void loadConfig();
          }, 1500);
        }
      }
    };

    void loadConfig();

    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, []);

  return (
    <>
      <Header />

      {!config && configError ? (
        <div className="config-banner">
          <span className="status-dot" />
          本地链还在启动，正在等待合约部署…
        </div>
      ) : null}

      <main>
        <Hero />
        <BlockchainLab />
        <WalletCard wallet={wallet} config={config} />
        <Guestbook wallet={wallet} config={config} />
        <Architecture />
      </main>

      <footer className="site-footer">
        <div className="container footer-inner">
          <span className="footer-title">
            ChainLab · 用一条本地链理解 Web3
          </span>
          <span className="muted small">
            Solidity · Hardhat · ethers.js · React · Express · SQLite
          </span>
          <span className="muted small">
            仅用于学习与本地演示，请勿用于生产环境。
          </span>
        </div>
      </footer>
    </>
  );
}
