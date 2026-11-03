export function shortAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function shortHash(hash: string): string {
  if (hash.length <= 18) return hash;
  return `${hash.slice(0, 10)}…${hash.slice(-6)}`;
}

export function formatTime(seconds: number): string {
  return new Date(seconds * 1000).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function addressColor(address: string): string {
  let hash = 0;

  for (let i = 2; i < address.length; i++) {
    hash = (hash * 31 + address.charCodeAt(i)) >>> 0;
  }

  return `hsl(${hash % 360} 72% 56%)`;
}

export function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

export function errorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    const code = (error as { code?: unknown }).code;
    if (code === 4001 || code === "ACTION_REJECTED") {
      return "你在钱包里取消了这次操作。";
    }
  }

  if (error instanceof Error) return error.message;
  return "操作失败，请重试。";
}
