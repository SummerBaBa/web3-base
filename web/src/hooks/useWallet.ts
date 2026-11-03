import { useCallback, useEffect, useRef, useState } from "react";
import {
  BrowserProvider,
  formatEther,
  type JsonRpcSigner,
} from "ethers";

import { errorMessage } from "../lib/format";

export type WalletState = {
  address: string | null;
  chainId: number | null;
  balance: string | null;
  connecting: boolean;
  error: string | null;
};

const INITIAL_STATE: WalletState = {
  address: null,
  chainId: null,
  balance: null,
  connecting: false,
  error: null,
};

export function useWallet(targetChainId: number) {
  const [state, setState] = useState<WalletState>(INITIAL_STATE);
  const providerRef = useRef<BrowserProvider | null>(null);

  const refresh = useCallback(async () => {
    const ethereum = window.ethereum;
    if (!ethereum) return;

    try {
      const provider = new BrowserProvider(ethereum);
      const accounts = (await provider.send("eth_accounts", [])) as string[];

      if (accounts.length === 0) {
        providerRef.current = null;
        setState(INITIAL_STATE);
        return;
      }

      const network = await provider.getNetwork();
      const balance = await provider.getBalance(accounts[0]);
      providerRef.current = provider;

      setState({
        address: accounts[0],
        chainId: Number(network.chainId),
        balance: formatEther(balance),
        connecting: false,
        error: null,
      });
    } catch (error) {
      setState((previous) => ({
        ...previous,
        connecting: false,
        error: errorMessage(error),
      }));
    }
  }, []);

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      setState((previous) => ({
        ...previous,
        error: "未检测到浏览器钱包，请先安装 MetaMask。",
      }));
      return;
    }

    setState((previous) => ({
      ...previous,
      connecting: true,
      error: null,
    }));

    try {
      const provider = new BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      await refresh();
    } catch (error) {
      setState((previous) => ({
        ...previous,
        connecting: false,
        error: errorMessage(error),
      }));
    }
  }, [refresh]);

  const disconnect = useCallback(() => {
    providerRef.current = null;
    setState(INITIAL_STATE);
  }, []);

  const ensureNetwork = useCallback(async () => {
    const ethereum = window.ethereum;
    if (!ethereum) throw new Error("未检测到浏览器钱包。");

    const provider = providerRef.current ?? new BrowserProvider(ethereum);
    const network = await provider.getNetwork();

    if (Number(network.chainId) === targetChainId) return;

    const chainIdHex = `0x${targetChainId.toString(16)}`;

    try {
      await ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: chainIdHex }],
      });
    } catch (error) {
      const code = (error as { code?: number }).code;

      if (code === 4902) {
        await ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: chainIdHex,
              chainName: "ChainLab 本地链",
              rpcUrls: ["http://127.0.0.1:8545"],
              nativeCurrency: {
                name: "Ether",
                symbol: "ETH",
                decimals: 18,
              },
            },
          ],
        });
      } else {
        throw error;
      }
    }

    await refresh();
  }, [targetChainId, refresh]);

  const getSigner = useCallback(async (): Promise<JsonRpcSigner> => {
    const ethereum = window.ethereum;
    if (!ethereum) throw new Error("未检测到浏览器钱包。");

    await ensureNetwork();

    const provider = new BrowserProvider(ethereum);
    const accounts = (await provider.send("eth_accounts", [])) as string[];

    if (accounts.length === 0) {
      throw new Error("请先连接钱包。");
    }

    providerRef.current = provider;
    return provider.getSigner();
  }, [ensureNetwork]);

  useEffect(() => {
    void refresh();

    const ethereum = window.ethereum;
    if (!ethereum?.on) return;

    const handleChange = () => {
      void refresh();
    };

    ethereum.on("accountsChanged", handleChange);
    ethereum.on("chainChanged", handleChange);

    return () => {
      ethereum.removeListener?.("accountsChanged", handleChange);
      ethereum.removeListener?.("chainChanged", handleChange);
    };
  }, [refresh]);

  return {
    ...state,
    connect,
    disconnect,
    refresh,
    ensureNetwork,
    getSigner,
  };
}

export type WalletApi = ReturnType<typeof useWallet>;
