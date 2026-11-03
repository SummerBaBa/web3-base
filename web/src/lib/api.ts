// 前端访问后端 REST API 的封装。
//
// 所有请求都使用相对路径 /api/...，开发环境由 Vite 代理到 8787 端口，
// 生产环境由 Express 同源托管，因此不需要处理跨域。

import type { ChainNote, DeploymentConfig, Stats } from "./types";

/**
 * 通用 JSON 请求函数。
 *
 * 设计要点：
 * 1. 使用泛型 T 让调用方拿到明确的返回类型；
 * 2. 非 2xx 响应时，尽量读取后端返回的 { error } 文案；
 * 3. 如果响应不是 JSON（例如代理错误页），回退到状态码提示。
 *
 * @param url 请求地址
 * @returns 解析后的 JSON
 */
async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);

  if (!response.ok) {
    let message = `请求失败 (${response.status})`;

    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // 忽略非 JSON 响应，保留上面的状态码提示。
    }

    throw new Error(message);
  }

  return (await response.json()) as T;
}

/**
 * 后端接口集合。
 * 保持成对象形式，组件里用 api.notes() 这样的方式调用，语义清晰。
 */
export const api = {
  // 获取合约地址、chainId、ABI 等配置。
  config: () => getJson<DeploymentConfig>("/api/config"),

  // 获取最近的留言；limit 默认 50。
  notes: (limit = 50) =>
    getJson<{ notes: ChainNote[] }>(`/api/notes?limit=${limit}`),

  // 获取留言总数、独立作者数、最新区块高度。
  stats: () => getJson<Stats>("/api/stats"),
};
