// 链上事件索引器。
//
// 为什么需要它？
// 区块链擅长“存证”，但不擅长复杂查询：直接遍历链上日志又慢又贵。
// 所以生产环境通常会有这样一层：监听合约事件 -> 写入传统数据库 -> 对外提供 API。
// 本项目用几十行代码实现这个模式的迷你版。
//
// 数据流：
//   ChainLab.createNote()
//     -> 发出 NoteCreated 事件
//     -> 本文件监听事件
//     -> 写入 SQLite（db.js）
//     -> Express 提供 /api/notes
//     -> 前端展示

import { ethers } from "ethers";
import { saveNote } from "./db.js";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 等待 JSON-RPC 节点可用。
 * Hardhat 本地链启动需要一点时间，而 `npm run dev` 会并行启动各进程，
 * 所以这里通过反复调用 getBlockNumber() 来确认链已经能响应请求。
 *
 * @param {ethers.JsonRpcProvider} provider
 * @param {{ retries?: number, delayMs?: number }} [options]
 */
async function waitForRpc(provider, { retries = 120, delayMs = 500 } = {}) {
  let lastError;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      // 能拿到区块高度，说明 RPC 已经就绪。
      await provider.getBlockNumber();
      return;
    } catch (error) {
      lastError = error;
      await sleep(delayMs);
    }
  }

  throw new Error(`连接 RPC 超时：${lastError?.message ?? "unknown error"}`);
}

/**
 * 启动索引器：注册实时监听，并回填历史事件。
 *
 * @param {object} deployment 部署信息（address、abi、rpcUrl 等）
 * @returns {Promise<{ provider: ethers.JsonRpcProvider, contract: ethers.Contract, close: () => Promise<void> }>}
 */
export async function startIndexer(deployment) {
  const rpcUrl = deployment.rpcUrl ?? "http://127.0.0.1:8545";

  // JsonRpcProvider 通过 HTTP 与节点通信；它只读，不需要私钥。
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  // 用部署脚本写出的 ABI 和地址创建合约实例。
  // 这里传入 provider 而不是 signer，因为索引器只监听/查询，不发送交易。
  const contract = new ethers.Contract(
    deployment.address,
    deployment.abi,
    provider,
  );

  await waitForRpc(provider);

  /**
   * 把一个事件写入数据库。
   *
   * ethers v6 里事件对象有两种形态：
   * 1. queryFilter() 返回 EventLog，blockNumber/transactionHash/index 直接在对象上；
   * 2. 实时监听回调收到 ContractEventPayload，真正的日志在 payload.log 上。
   * 这里用 payload.log ?? payload 统一处理两种形态。
   */
  const persist = (payload) => {
    const log = payload.log ?? payload;

    // 事件参数里的 uint256 是 BigInt，SQLite 绑定参数时不接受 BigInt，
    // 所以这里显式转换成 Number（留言 id / 时间戳都在安全整数范围内）。
    const { id, author, content, createdAt } = payload.args;

    saveNote({
      id: Number(id),
      author,
      content,
      createdAt: Number(createdAt),
      blockNumber: log.blockNumber,
      txHash: log.transactionHash,
      logIndex: log.index ?? 0,
    });

    console.log(`[indexer] note #${id} ← ${author}`);
  };

  // filters.NoteCreated() 生成一个“匹配所有 NoteCreated 事件”的过滤器。
  const filter = contract.filters.NoteCreated();

  /**
   * 实时监听回调。
   * 使用 filter 监听时，ethers 只传一个参数（事件对象），
   * 所以取 args[args.length - 1] 能同时兼容“参数 + 事件”的旧式回调。
   */
  const onNote = (...args) => {
    try {
      persist(args[args.length - 1]);
    } catch (error) {
      // 单个事件处理失败不应该让整个索引器崩溃。
      console.error("[indexer] 处理事件失败:", error);
    }
  };

  // 先注册监听，再回填历史事件。
  // 顺序很重要：如果先回填再监听，回填与注册之间产生的新事件可能会漏掉。
  // 反过来，监听和回填可能重复处理同一事件，但数据库层的唯一索引 + INSERT OR IGNORE
  // 保证了幂等，所以“先监听、后回填”是更安全的选择。
  contract.on(filter, onNote);
  console.log("[indexer] 已注册 NoteCreated 事件监听");

  const backfill = async () => {
    // 从创世区块查到最新区块，补上服务启动前已经发生的事件。
    const events = await contract.queryFilter(filter, 0, "latest");
    events.forEach(persist);
    return events.length;
  };

  const backfilled = await backfill();
  console.log(`[indexer] 已回填 ${backfilled} 条历史留言`);

  // 监听底层连接错误，方便排查节点断开等问题。
  provider.on("error", (error) => {
    console.error("[indexer] provider error:", error.message);
  });

  return {
    provider,
    contract,
    /**
     * 优雅关闭：移除监听并销毁 provider，释放轮询定时器。
     */
    async close() {
      contract.off(filter, onNote);
      provider.destroy();
    },
  };
}
