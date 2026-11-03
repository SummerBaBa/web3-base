// 读取合约部署信息的工具模块。
//
// 部署脚本会把合约地址、chainId、ABI 写进 server/data/deployment.json。
// 后端启动时可能比部署脚本更早，所以这里采用“轮询等待”的方式：
// 文件还没出现就等一会儿再试，直到超时。

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 与 contracts/scripts/deploy.js 中的输出路径保持一致。
const deploymentPath = path.resolve(__dirname, "../data/deployment.json");

// 简单的 sleep 工具，用于控制重试间隔。
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 等待 Hardhat 部署脚本写出 deployment.json。
 *
 * 默认最多重试 120 次、每次间隔 500ms，也就是最多等待 60 秒。
 * 之所以需要等待，是因为 `npm run dev` 会并行启动链、部署、后端和前端，
 * 后端很可能先于部署脚本就绪。
 *
 * @param {object} [options]
 * @param {number} [options.retries=120] 最大重试次数
 * @param {number} [options.delayMs=500] 每次重试的间隔（毫秒）
 * @returns {Promise<object>} 解析后的部署信息
 */
export async function waitForDeployment({ retries = 120, delayMs = 500 } = {}) {
  let lastError;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      // 文件可能正在被写入，JSON.parse 失败也会进入 catch 重试。
      const raw = await readFile(deploymentPath, "utf8");
      const deployment = JSON.parse(raw);

      // 基础校验：没有地址或 ABI 就无法创建合约实例。
      if (!deployment.address || !deployment.abi) {
        throw new Error("deployment.json 缺少 address 或 abi");
      }

      return deployment;
    } catch (error) {
      lastError = error;
      await sleep(delayMs);
    }
  }

  throw new Error(
    `等待合约部署超时（${deploymentPath}）：${lastError?.message ?? "unknown error"}`,
  );
}

export { deploymentPath };
