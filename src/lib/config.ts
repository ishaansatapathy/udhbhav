const RAW_SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:4000"

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "")
}

export const SERVER_URL = normalizeBaseUrl(RAW_SERVER_URL)
export const API_BASE = SERVER_URL

