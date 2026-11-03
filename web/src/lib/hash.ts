import type { LabBlock } from "./types";

export const DIFFICULTY_PREFIX = "00";
export const GENESIS_PREV_HASH = "0".repeat(64);

export async function sha256(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function blockPayload(block: Omit<LabBlock, "hash">): string {
  return [
    block.index,
    block.timestamp,
    block.data,
    block.prevHash,
    block.nonce,
  ].join("|");
}

/**
 * 简单的 PoW：不断调整 nonce，直到 SHA-256 哈希以 "00" 开头。
 * 真实区块链的难度会动态调整，这里固定为两个十六进制字符，
 * 方便在浏览器里瞬间看到结果。
 */
export async function mineBlock(
  block: Omit<LabBlock, "hash">,
  startNonce = block.nonce,
): Promise<{ nonce: number; hash: string }> {
  let nonce = startNonce;

  for (let attempt = 0; attempt < 1_000_000; attempt++) {
    const hash = await sha256(blockPayload({ ...block, nonce }));
    if (hash.startsWith(DIFFICULTY_PREFIX)) {
      return { nonce, hash };
    }
    nonce++;
  }

  throw new Error("挖矿超时，请重试");
}
