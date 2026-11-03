// Express API 服务。
//
// 职责：
// 1. 等待合约部署完成，读取部署信息；
// 2. 启动事件索引器，把链上留言同步到 SQLite；
// 3. 提供 REST API 给前端查询；
// 4. 如果前端已经构建（web/dist），顺带做静态文件托管。
//
// 端口默认 8787，可通过环境变量 PORT 覆盖。

import express from "express";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { getStats, listNotes, resetNotes } from "./db.js";
import { waitForDeployment } from "./deployment.js";
import { startIndexer } from "./indexer.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 8787);

const app = express();

// 允许解析 JSON 请求体。当前所有写操作都直接发到链上，
// 这里主要为了未来扩展 POST 接口时可以直接使用 req.body。
app.use(express.json());

// 运行期状态，供 /api/health 查询。
let deployment = null;
let indexerReady = false;
let indexerError = null;

/**
 * 健康检查：前端或运维可以用它判断服务是否就绪。
 * 即使索引器启动失败，API 仍会返回 ok: true，但 indexerReady 为 false。
 */
app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    indexerReady,
    indexerError,
    contract: deployment?.address ?? null,
    chainId: deployment?.chainId ?? null,
  });
});

/**
 * 前端启动时拉取合约配置：
 * - address / chainId：判断钱包网络、创建合约实例；
 * - abi：ethers.Contract 编码/解码函数调用所需；
 * - rpcUrl / network / deployedAt：展示和调试用。
 *
 * 部署完成前返回 503，前端会定时重试。
 */
app.get("/api/config", (_req, res) => {
  if (deployment === null) {
    return res.status(503).json({ error: "合约尚未部署，请稍后重试" });
  }

  const { address, chainId, network, rpcUrl, deployedAt, abi } = deployment;
  res.json({ address, chainId, network, rpcUrl, deployedAt, abi });
});

/**
 * 查询留言列表。
 * limit 来自查询字符串，必须做类型转换和范围限制：
 * - 防止传入 "abc" 导致 NaN；
 * - 防止一次请求拉取过多数据（最大 200 条）。
 */
app.get("/api/notes", (req, res) => {
  const requested = Number.parseInt(String(req.query.limit ?? "50"), 10);
  const limit = Number.isFinite(requested)
    ? Math.min(Math.max(requested, 1), 200)
    : 50;

  res.json({ notes: listNotes(limit) });
});

/**
 * 聚合统计：留言总数、独立作者数、最新区块高度。
 * 数据来自 SQLite，查询很快，不需要每次都问链。
 */
app.get("/api/stats", (_req, res) => {
  res.json(getStats());
});

// 如果已经执行过 `npm run build`，web/dist 会存在。
// 这时由同一个 Express 服务托管前端，生产部署更简单。
const webDist = path.resolve(__dirname, "../../web/dist");
if (existsSync(path.join(webDist, "index.html"))) {
  app.use(express.static(webDist));

  // SPA 回退：非 /api 的 GET 请求都返回 index.html，
  // 这样前端路由（如果以后加了 react-router）刷新页面也不会 404。
  // 注意 Express 5 不再支持 app.get("*")，所以用中间件实现。
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api")) {
      return next();
    }
    res.sendFile(path.join(webDist, "index.html"));
  });
}

async function main() {
  // 阻塞等待部署脚本写出 deployment.json（最多约 60 秒）。
  deployment = await waitForDeployment();
  console.log(
    `[server] 合约已加载: ${deployment.address} (chainId ${deployment.chainId})`,
  );

  // 每次启动都清空索引表，再从链上事件重新回填。
  // 原因：本地 Hardhat 链每次重启都是全新的，
  // 如果保留旧数据库，会和链上状态不一致。
  resetNotes();

  // 先启动 HTTP 服务，再启动索引器。
  // 这样即使索引器还在回填，前端也能立即拿到 /api/config 和空列表。
  const server = app.listen(PORT, () => {
    console.log(`[server] API 已启动: http://localhost:${PORT}`);
  });

  try {
    const indexer = await startIndexer(deployment);
    indexerReady = true;
    console.log("[server] 事件索引器已就绪");

    // 收到 Ctrl+C / kill 时优雅退出：
    // 先移除事件监听、销毁 provider，再关闭 HTTP 服务。
    const shutdown = async () => {
      await indexer.close();
      server.close(() => process.exit(0));
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } catch (error) {
    // 索引器失败不影响只读 API，前端仍能看到已索引的数据（通常为空）。
    indexerError = error.message;
    console.error("[server] 索引器启动失败，API 仍可使用:", error.message);
  }
}

main().catch((error) => {
  console.error("[server] 启动失败:", error);
  process.exit(1);
});
