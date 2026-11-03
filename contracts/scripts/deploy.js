// 部署脚本：把 ChainLab 合约部署到本地 Hardhat 链，并写出部署信息。
//
// 它承担了“链”与“应用”之间的桥梁作用：
//   1. 编译产物 -> 部署到链上，拿到合约地址；
//   2. 写入几条示例留言，让前端一打开就有数据；
//   3. 把地址、chainId、ABI 写进 server/data/deployment.json，
//      后端索引器和前端都通过这份文件知道该和哪个合约交互。

import { network } from "hardhat";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ESM 模块里没有 CommonJS 的 __dirname，需要从 import.meta.url 手动推导。
// 这样无论从哪个目录执行脚本，路径都是相对当前文件解析的。
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 部署信息输出到 server/data/，该目录已被 .gitignore 忽略。
// 后端启动时会等待并读取这个文件。
const outputDir = path.resolve(__dirname, "../../server/data");
const outputFile = path.join(outputDir, "deployment.json");

// 示例留言。使用三个不同账户写入，方便在前端看到不同的 msg.sender。
const SEED_NOTES = [
  "第一条链上留言：数据一旦写入区块，就无法被悄悄篡改。",
  "这条消息由部署脚本用另一个账户写入，用来演示 msg.sender。",
  "试试连接钱包，把你自己的留言永久写进这条链。",
];

// network.create() 会根据 `--network localhost` 参数创建连接，
// 并在 hardhat-ethers 插件的帮助下提供 ethers 实例。
const { ethers } = await network.create();

// Hardhat 默认提供 20 个已解锁、各带 10000 ETH 的测试账户。
// 这里取前三个：deployer 负责部署，alice/bob 负责写示例留言。
const [deployer, alice, bob] = await ethers.getSigners();

console.log("正在部署 ChainLab 合约...");

// getContractFactory 会读取编译产物（artifacts）里的 ABI 和字节码。
const factory = await ethers.getContractFactory("ChainLab");

// deploy() 发送一笔“合约创建”交易；waitForDeployment() 等待交易被打包，
// 之后合约才真正拥有地址、可以被调用。
const contract = await factory.deploy();
await contract.waitForDeployment();

const address = await contract.getAddress();
const networkInfo = await ethers.provider.getNetwork();
const chainId = Number(networkInfo.chainId);

console.log(`ChainLab 已部署到: ${address} (chainId: ${chainId})`);

// 只在合约里还没有留言时写入示例数据。
// 这样重复部署时不会不断叠加示例内容。
if ((await contract.noteCount()) === 0n) {
  console.log("写入示例留言...");

  const authors = [deployer, alice, bob];

  for (let i = 0; i < SEED_NOTES.length; i++) {
    // contract.connect(signer) 会切换调用者。
    // createNote 是写操作，所以这里发送的是一笔真实交易。
    const tx = await contract.connect(authors[i]).createNote(SEED_NOTES[i]);

    // 等待每笔交易上链，确保示例留言按顺序写入。
    await tx.wait();
  }
}

// 把前端/后端需要的信息汇总成一份 JSON。
// interface.formatJson() 输出标准 JSON ABI，前端可以直接传给 ethers.Contract。
const deployment = {
  name: "ChainLab",
  chainId,
  address,
  network: networkInfo.name,
  rpcUrl: "http://127.0.0.1:8545",
  deployedAt: new Date().toISOString(),
  abi: JSON.parse(contract.interface.formatJson()),
};

// 确保目录存在后再写入；recursive: true 允许目录已存在。
await mkdir(outputDir, { recursive: true });
await writeFile(outputFile, JSON.stringify(deployment, null, 2));

console.log(`部署信息已写入 ${outputFile}`);
console.log("完成 ✅");
