const LINKS = [
  { href: "#lab", label: "可视化实验室" },
  { href: "#wallet", label: "钱包" },
  { href: "#guestbook", label: "链上留言板" },
  { href: "#architecture", label: "架构" },
];

export function Header() {
  return (
    <header className="site-header">
      <div className="container header-inner">
        <a className="brand" href="#top">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9.5 14.5 14.5 9.5" strokeLinecap="round" />
              <path
                d="M8.2 12.1 6.6 13.7a3.6 3.6 0 0 0 5.1 5.1l1.6-1.6"
                strokeLinecap="round"
              />
              <path
                d="M15.8 11.9l1.6-1.6a3.6 3.6 0 0 0-5.1-5.1L10.7 6.8"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <span className="brand-name">ChainLab</span>
        </a>

        <nav className="nav" aria-label="主导航">
          {LINKS.map((link) => (
            <a key={link.href} href={link.href}>
              {link.label}
            </a>
          ))}
        </nav>

        <span className="chain-pill">
          <span className="status-dot" />
          本地链 31337
        </span>
      </div>
    </header>
  );
}
