import { SectionHeading } from "./SectionHeading";

const LAYERS = [
  {
    step: "01",
    title: "React 前端",
    tag: "web/",
    body: "钱包连接、合约调用、区块链可视化，全部在这里发生。",
  },
  {
    step: "02",
    title: "MetaMask 钱包",
    tag: "浏览器插件",
    body: "保管私钥并完成签名。私钥永远不会发送到服务器。",
  },
  {
    step: "03",
    title: "Solidity 合约",
    tag: "Hardhat 本地链",
    body: "执行 createNote，把留言写入区块，并发出 NoteCreated 事件。",
  },
  {
    step: "04",
    title: "事件索引器",
    tag: "Node + ethers",
    body: "监听链上事件，把不可变的事件日志整理进 SQLite。",
  },
  {
    step: "05",
    title: "REST API",
    tag: "Express",
    body: "把索引结果以普通 JSON 暴露给前端，查询快且易于分页。",
  },
];

const CONCEPTS = [
  {
    title: "账户与私钥",
    body: "地址是公开的身份，私钥是唯一的控制权。钱包替你保管私钥并签名。",
  },
  {
    title: "交易与 Gas",
    body: "写链不是免费的：每笔交易都要支付 gas，等待被打包进区块。",
  },
  {
    title: "智能合约",
    body: "部署在链上的程序。函数调用会改变状态，视图函数只读取状态。",
  },
  {
    title: "事件与索引",
    body: "链擅长存证，不擅长复杂查询。索引器把事件同步到数据库，兼顾两者。",
  },
];

export function Architecture() {
  return (
    <section className="section container" id="architecture">
      <SectionHeading
        eyebrow="Behind the scenes"
        title="一笔留言，经过了哪些层？"
        description="这是典型的 Web3 全栈架构：链负责最终一致性，链下服务负责可查询性，前端负责体验。"
      />

      <div className="arch-flow">
        {LAYERS.map((layer, index) => (
          <div className="arch-item" key={layer.step}>
            <div className="arch-card">
              <span className="arch-step">{layer.step}</span>
              <h3>{layer.title}</h3>
              <span className="tag">{layer.tag}</span>
              <p>{layer.body}</p>
            </div>
            {index < LAYERS.length - 1 ? (
              <span className="arch-arrow" aria-hidden="true">
                →
              </span>
            ) : null}
          </div>
        ))}
      </div>

      <div className="concept-grid">
        {CONCEPTS.map((concept) => (
          <div className="concept-card" key={concept.title}>
            <h3>{concept.title}</h3>
            <p>{concept.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
