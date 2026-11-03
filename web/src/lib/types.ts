// 全局共享的 TypeScript 类型定义。
// 把“后端返回什么”“合约配置长什么样”“可视化区块有哪些字段”集中在一处，
// 组件和 API 层都从这里导入，避免各写一份、逐渐不一致。

/**
 * 后端 /api/config 返回的合约部署信息。
 * 对应 contracts/scripts/deploy.js 写出的 deployment.json。
 */
export type DeploymentConfig = {
  address: string; // 合约地址
  chainId: number; // 链 ID，本项目中是 31337
  network: string; // 网络名称，例如 localhost
  rpcUrl: string; // JSON-RPC 地址
  deployedAt: string; // 部署时间（ISO 字符串）
  abi: unknown[]; // 合约 ABI，用于 ethers.Contract 编解码
};

/**
 * 后端 /api/notes 返回的一条留言。
 * 字段名与 SQLite 查询里的 AS 别名保持一致（camelCase）。
 */
export type ChainNote = {
  id: number; // 链上留言编号
  author: string; // 作者地址
  content: string; // 留言内容
  createdAt: number; // 链上时间戳（秒）
  blockNumber: number; // 所在区块高度
  txHash: string; // 交易哈希
};

/**
 * 后端 /api/stats 返回的聚合统计。
 */
export type Stats = {
  totalNotes: number; // 留言总数
  uniqueAuthors: number; // 独立作者数
  latestBlock: number; // 已索引的最新区块高度
};

/**
 * 前端“可视化实验室”里的一个区块。
 * 注意：这是纯前端模拟的数据结构，不会写入真实区块链。
 * 字段刻意与真实区块保持相似：index、timestamp、data、prevHash、nonce、hash。
 */
export type LabBlock = {
  index: number; // 区块高度（从 0 开始的创世区块）
  timestamp: number; // 生成时间（毫秒）
  data: string; // 区块里保存的“交易数据”（演示用字符串）
  prevHash: string; // 上一个区块的哈希，用来形成链
  nonce: number; // 工作量证明的计数器
  hash: string; // 当前区块的 SHA-256 哈希
};
