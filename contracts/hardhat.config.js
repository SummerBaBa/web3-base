// Hardhat 3 的配置文件。
// 这个文件决定了：使用哪些插件、如何编译 Solidity、以及可以连接哪些网络。
import { defineConfig } from "hardhat/config";
import hardhatEthers from "@nomicfoundation/hardhat-ethers";
import hardhatNodeTestRunner from "@nomicfoundation/hardhat-node-test-runner";

export default defineConfig({
  // 插件系统：
  // - hardhat-ethers：给 Hardhat 注入 ethers.js v6，方便部署和调用合约
  // - hardhat-node-test-runner：使用 Node.js 内置的 node:test 运行测试
  plugins: [hardhatEthers, hardhatNodeTestRunner],

  solidity: {
    // 与合约顶部的 pragma 保持一致。
    version: "0.8.28",
    settings: {
      // 开启优化器，减小部署字节码、降低运行 gas。
      // runs: 200 表示按“大约会被调用 200 次”来权衡部署成本与执行成本。
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },

  networks: {
    // `hardhat node` 默认会在 127.0.0.1:8545 启动一条内存测试链。
    // 这里显式声明 localhost 网络，部署脚本通过
    // `hardhat run scripts/deploy.js --network localhost` 连接它。
    localhost: {
      type: "http", // 通过 HTTP JSON-RPC 连接，而不是 Hardhat 内置的模拟网络
      url: "http://127.0.0.1:8545",
      chainId: 31337, // MetaMask 里需要填写的 Chain ID
    },
  },
});
