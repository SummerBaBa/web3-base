# ChainLab · Web3 入门实验室

一个**看得见、摸得着**的 Web3 全栈入门项目。

它把区块链最抽象的几个概念——哈希、区块、工作量证明、钱包签名、交易、Gas、智能合约、事件索引——串成一条完整的链路。你可以在浏览器里亲手篡改一条区块链，也可以连接钱包，把一条留言真正写进本地区块链。

> 技术栈：Solidity · Hardhat · ethers.js · React · TypeScript · Express · SQLite

![ChainLab 预览](docs/preview.png)

---

## 1. 这个项目能帮你理解什么

| 概念 | 在项目里的体现 |
| --- | --- |
| 哈希与不可篡改 | 可视化实验室用 Web Crypto SHA-256 计算区块哈希 |
| 前哈希链接 | 每个区块保存上一个区块的哈希，篡改会级联失效 |
| 工作量证明（PoW） | 哈希必须以 `00` 开头，前端实时调整 nonce 挖矿 |
| 钱包与私钥 | MetaMask 保管私钥，网站只拿到地址和签名 |
| 交易与 Gas | 每次留言都是一笔交易，需要钱包确认并消耗测试 ETH |
| 智能合约 | `ChainLab.sol` 的 `createNote()` 把留言写入链上状态 |
| 事件 | 合约发出 `NoteCreated`，后端索引器监听并同步 |
| 链上 / 链下架构 | 链负责最终一致性，SQLite + REST API 负责快速查询 |

---

## 2. 功能一览

- **可视化区块链实验室**：添加区块、调整 nonce 挖矿、篡改数据、观察整条链级联失效、一键重新挖矿修复。
- **钱包连接**：连接 MetaMask，展示地址、Chain ID、余额，自动检测并切换本地网络。
- **链上留言板**：调用真实 Solidity 合约写入留言，完整展示「签名 → 广播 → 打包 → 索引」四步状态。
- **事件索引器**：Node + ethers.js 监听 `NoteCreated` 事件，写入 SQLite，并提供 REST API。
- **链上动态**：展示留言、作者、区块高度、交易哈希、时间与统计信息。
- **架构讲解**：把前端、钱包、合约、索引器、API 的分工画清楚。

---

## 3. 架构

```text
┌─────────────────────────────────────────────────────────────┐
│                        浏览器 / React                        │
│  可视化实验室   ·   钱包连接   ·   链上留言板               │
└───────────┬──────────────────────────────┬──────────────────┘
            │ ① 请求签名                    │ ⑤ GET /api/notes
            ▼                              ▼
     ┌─────────────┐                ┌─────────────┐
     │  MetaMask   │                │   Express   │
     │  保管私钥   │                │   REST API  │
     └──────┬──────┘                └──────▲──────┘
            │ ② 签名后的交易                 │ ④ 查询
            ▼                              │
     ┌──────────────────────────┐    ┌──────┴──────┐
     │   Hardhat 本地链 31337   │    │   SQLite    │
     │   ChainLab.sol 合约      │    │  留言索引表 │
     └────────────┬─────────────┘    └──────▲──────┘
                  │ ③ NoteCreated 事件       │ 写入
                  └──────────────►  Node + ethers.js 索引器
```

**为什么要索引器？**
区块链擅长存证，但不擅长复杂查询。直接遍历链上事件又慢又贵，所以生产环境通常会有一个链下索引层（The Graph、自建 Indexer 等）。本项目用几十行代码实现了这个模式的迷你版。

---

## 4. 快速开始

### 环境要求

- Node.js **>= 22.5**（使用了内置的 `node:sqlite`）
- npm
- MetaMask 浏览器插件（用于链上留言）

### 安装与启动

```bash
npm install
npm run dev
```

`npm run dev` 会同时启动四件事：

1. **Hardhat 本地链**：`http://127.0.0.1:8545`，Chain ID `31337`
2. **合约部署**：部署 `ChainLab`，写入 3 条示例留言，生成 `server/data/deployment.json`
3. **Express API**：`http://localhost:8787`
4. **Vite 前端**：`http://localhost:5173`

打开 **http://localhost:5173** 即可。

> 第一次启动需要下载 Solidity 编译器，可能会多花十几秒。

### 配置 MetaMask

在 MetaMask 中添加本地网络：

| 参数 | 值 |
| --- | --- |
| 网络名称 | ChainLab 本地链 |
| RPC URL | `http://127.0.0.1:8545` |
| Chain ID | `31337` |
| 货币符号 | `ETH` |

然后导入一个 Hardhat 测试账户（**仅限本地开发，切勿用于真实资产**）：

```text
0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

该账户自带 10000 测试 ETH，足够你反复体验交易。也可以直接在前端点击「切换到本地链」，让 MetaMask 自动添加网络。

---

## 5. 推荐体验流程

1. 打开「可视化实验室」，点击任意区块的「篡改数据」，观察整条链从篡改点开始失效。
2. 点击「修复整条链」，看它如何重新挖矿；篡改越靠前，需要重做的计算越多。
3. 连接钱包，确认网络是 `31337`。
4. 在「链上留言板」写一句话，点击「签名并上链」，在 MetaMask 中确认。
5. 观察四步状态：钱包签名 → 广播交易 → 打包上链 → 索引同步。
6. 刷新页面，留言依然存在——它已经写进了链和索引数据库。

---

## 6. 项目结构

```text
chainlab/
├── contracts/                 # Solidity + Hardhat
│   ├── contracts/ChainLab.sol # 链上留言合约
│   ├── scripts/deploy.js      # 部署 + 写入示例数据
│   ├── test/ChainLab.test.js  # 合约测试
│   └── hardhat.config.js
├── server/                    # Node + Express + SQLite
│   └── src/
│       ├── index.js           # REST API + 静态文件服务
│       ├── indexer.js         # 监听 NoteCreated 事件
│       ├── db.js              # node:sqlite 数据访问
│       └── deployment.js      # 等待并读取部署信息
├── web/                       # React + TypeScript + Vite
│   └── src/
│       ├── components/        # 可视化实验室、钱包、留言板、架构图
│       ├── hooks/useWallet.ts # 钱包连接与网络切换
│       └── lib/hash.ts        # SHA-256 与 PoW 挖矿
├── package.json               # npm workspaces + 一键启动脚本
└── README.md
```

---

## 7. 核心实现说明

### 合约：`contracts/contracts/ChainLab.sol`

- `createNote(string content)`：校验非空、最长 280 字节，写入 `Note[]`，发出 `NoteCreated` 事件。
- `noteCount()` / `getNote(id)` / `getRecentNotes(offset, limit)`：视图函数，读取链上状态。
- 使用自定义错误 `EmptyContent`、`ContentTooLong`，比字符串 `require` 更省 Gas。

### 索引器：`server/src/indexer.js`

- 启动时先注册事件监听，再 `queryFilter` 回填历史事件，避免漏事件。
- 兼容 ethers.js v6 的两种事件形态：`queryFilter` 返回 `EventLog`，实时监听返回 `ContractEventPayload`（真实日志在 `.log` 上）。
- 使用 `INSERT OR IGNORE` + `(tx_hash, log_index)` 唯一索引做幂等，重复回填不会产生脏数据。

### 前端：`web/src/lib/hash.ts`

- 用浏览器原生 `crypto.subtle.digest("SHA-256", ...)` 计算哈希。
- `mineBlock()` 不断递增 `nonce`，直到哈希以 `00` 开头，直观展示 PoW。
- 区块校验包含三层：哈希是否匹配内容、是否满足难度、前哈希是否链接正确。

### API

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/health` | 服务与索引器健康状态 |
| `GET` | `/api/config` | 合约地址、Chain ID、ABI |
| `GET` | `/api/notes?limit=50` | 索引后的留言列表 |
| `GET` | `/api/stats` | 留言总数、独立作者数、最新区块 |

---

## 8. 常用脚本

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 一键启动本地链、部署、后端、前端 |
| `npm run build` | 编译合约并构建前端产物 |
| `npm test` | 运行 Hardhat 合约测试 |
| `npm run clean` | 删除编译产物、数据库与前端构建产物 |
| `npm run chain` | 只启动 Hardhat 本地链 |
| `npm run deploy` | 只部署合约（需要链已启动） |
| `npm run server` | 只启动后端 API |

### 单独运行某一部分

```bash
# 终端 1：本地链
npm run chain

# 终端 2：部署
npm run deploy

# 终端 3：后端
npm run server

# 终端 4：前端
npm --workspace web run dev
```

---

## 9. 测试

```bash
npm test
```

当前覆盖 5 个合约用例：

- 初始状态无留言
- 写入留言并正确记录作者、内容、事件
- 拒绝空内容
- 拒绝超过 280 字节的内容
- `getRecentNotes` 分页与顺序正确

前端与后端已完成端到端联调验证：钱包连接、交易发送、事件索引、列表刷新全链路可用。

---

## 10. 常见问题

**Q：端口被占用？**
分别释放 `8545`（链）、`8787`（API）、`5173`（前端），或修改对应配置。

**Q：MetaMask 提示网络不对？**
点击页面里的「切换到本地链」，或手动添加 Chain ID `31337` 的网络。

**Q：没有测试 ETH？**
导入上面给出的 Hardhat 账户 #0 私钥；它默认有 10000 ETH。

**Q：想清空所有数据重新开始？**

```bash
npm run clean
npm run dev
```

`server/data` 里的 SQLite 数据库和部署信息都会重新生成。

**Q：修改合约后前端没变化？**
重新运行 `npm run dev`。索引器会在启动时重新读取 `server/data/deployment.json`。

---

## 11. 简历怎么写

### 中文版本

- 独立设计并实现 Web3 全栈 DApp「ChainLab」：使用 Solidity + Hardhat 开发链上留言合约，React + TypeScript + ethers.js 实现钱包连接与合约交互，Node/Express + SQLite 构建事件索引器与 REST API。
- 基于 Web Crypto SHA-256 实现区块链可视化实验室，支持 PoW 挖矿、数据篡改与级联失效演示，将哈希链、不可篡改性等抽象概念转化为可交互体验。
- 设计「链上事件 → 链下索引 → 前端查询」的数据链路，通过事件回填、幂等写入与唯一索引保证数据一致性，解决区块链原生查询能力弱的问题。
- 编写 Hardhat 合约测试并完成前后端端到端联调，覆盖钱包签名、交易上链、事件监听与交易状态流转。

### English version

- Built **ChainLab**, a full-stack Web3 DApp with Solidity/Hardhat smart contracts, a React + TypeScript + ethers.js frontend, and a Node/Express + SQLite event indexer.
- Implemented an interactive blockchain lab using Web Crypto SHA-256, demonstrating proof-of-work mining, tampering, and cascading chain invalidation.
- Designed an on-chain event → off-chain index → REST API pipeline with backfilling, idempotent writes, and unique indexes to provide fast, consistent queries.
- Wrote Hardhat contract tests and validated the full flow from wallet signing and transaction mining to event indexing and UI state transitions.

---

## 12. 可以继续扩展的方向

- 部署到 Sepolia 测试网，接入 Etherscan 交易链接
- 用 The Graph 替代自建索引器，对比两种方案
- 留言内容存 IPFS，链上只存 CID
- 增加点赞 / 打赏功能，演示 `payable` 与合约余额
- 加入 DAO 投票或 NFT 铸造，扩展成作品集项目
- 用 Docker Compose 一键编排链、索引器与前端

---

## License

仅用于学习与本地演示。请勿将本项目直接用于生产环境。
