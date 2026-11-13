import { authClient, API_URL } from './auth-client';

async function authHeaders(): Promise<HeadersInit> {
  const cookies = await authClient.getCookie();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (cookies) headers.Cookie = cookies;
  return headers;
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const headers = {
    ...(await authHeaders()),
    ...(init?.headers as Record<string, string> | undefined),
  };
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    credentials: 'omit',
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed (${res.status})`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function apiStream(
  path: string,
  init: RequestInit,
  onChunk: (line: string) => void,
) {
  const headers = {
    ...(await authHeaders()),
    ...(init.headers as Record<string, string> | undefined),
  };
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    credentials: 'omit',
  });
  if (!res.ok || !res.body) {
    throw new Error(`Stream failed (${res.status})`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n');
    buffer = parts.pop() ?? '';
    for (const part of parts) {
      const line = part.trim();
      if (!line || line === 'data: [DONE]') continue;
      if (line.startsWith('data: ')) onChunk(line.slice(6));
      else onChunk(line);
    }
  }
}

export { API_URL };
