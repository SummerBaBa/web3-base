const TECH = [
  "Solidity",
  "Hardhat",
  "ethers.js",
  "React",
  "Express",
  "SQLite",
];

export function Hero() {
  return (
    <section className="hero container" id="top">
      <div className="hero-copy">
        <span className="eyebrow">Web3 全栈入门项目</span>
        <h1>
          把区块链从概念，
          <br />
          <span className="gradient-text">变成看得见的东西。</span>
        </h1>
        <p className="hero-sub">
          ChainLab 用一条可以亲手篡改的区块链、一个真实的 Solidity
          合约，以及一层链下索引器，带你走完一笔交易从签名到上链的全过程。
        </p>

        <div className="hero-actions">
          <a className="btn btn-primary" href="#lab">
            进入可视化实验室
          </a>
          <a className="btn btn-ghost" href="#guestbook">
            写一条链上留言
          </a>
        </div>

        <div className="tech-chips" aria-label="技术栈">
          {TECH.map((tech) => (
            <span key={tech} className="chip">
              {tech}
            </span>
          ))}
        </div>
      </div>

      <div className="hero-visual" aria-hidden="true">
        <div className="mini-chain">
          <div className="mini-block">
            <span className="mini-label">BLOCK #128</span>
            <code>0x9f2a…c41d</code>
            <span className="mini-tag">3 tx</span>
          </div>

          <span className="mini-connector" />

          <div className="mini-block mini-block-accent">
            <span className="mini-label">BLOCK #129</span>
            <code>0x7d10…8be2</code>
            <span className="mini-tag">1 tx</span>
          </div>
        </div>

        <span className="hero-float hero-float-a">SHA-256</span>
        <span className="hero-float hero-float-b">NoteCreated</span>
        <span className="hero-float hero-float-c">tx confirmed</span>
      </div>
    </section>
  );
}
