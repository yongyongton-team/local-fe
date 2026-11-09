import { ApiError } from './apiError';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type QueryValue = string | number | boolean | null | undefined;

export interface HttpRequest {
  /** 호스트 + base path 가 붙은 전체 주소(쿼리 제외) */
  url: string;
  method?: HttpMethod;
  query?: Record<string, QueryValue | readonly QueryValue[]>;
  /** JSON 으로 보낼 본문. undefined 면 본문 없음 */
  body?: unknown;
  /** Authorization: Bearer 로 보낼 토큰 */
  token?: string;
  /** 호출한 쪽이 요청을 취소할 때 쓴다. 취소는 ApiError 가 아니라 원래의 AbortError 로 그대로 던진다. */
  signal?: AbortSignal;
  /** [임시] 기본 10초. 정확한 서버 응답 시간 기준이 없어 보수적으로 정했다. */
  timeoutMs?: number;
}

export const DEFAULT_TIMEOUT_MS = 10_000;

/** 쿼리 객체를 문자열로 직렬화한다. null·undefined 는 빼고, 배열은 같은 이름을 반복한다. */
export function buildQueryString(query: HttpRequest['query']): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    const values = Array.isArray(value) ? value : [value];
    for (const item of values as QueryValue[]) {
      if (item !== null && item !== undefined) params.append(key, String(item));
    }
  }
  const text = params.toString();
  return text ? `?${text}` : '';
}

/** 오류 본문에서 code 를 꺼낸다. JSON 이 아니거나 code 가 없으면 undefined. 서버 message 는 쓰지 않는다. */
function readErrorCode(text: string): string | undefined {
  try {
    const body: unknown = JSON.parse(text);
    if (typeof body === 'object' && body !== null && 'code' in body) {
      const code = (body as { code: unknown }).code;
      if (typeof code === 'string' && code !== '') return code;
      if (typeof code === 'number') return String(code);
    }
  } catch {
    // JSON 이 아닌 본문(nginx HTML 등)은 code 없이 넘어간다.
  }
  return undefined;
}

/**
 * fetch 를 한 번 보내고 JSON 을 돌려준다. 오류는 ApiError 로 정규화한다.
 * - 204 와 빈 본문은 undefined 를 돌려준다.
 * - 타임아웃이면 kind 'timeout', 서버에 닿지 못하면 'network', 오류 상태면 'http', 본문을 해석할 수 없으면 'parse'.
 * - 전역 fetch 를 호출 시점에 읽는다(테스트에서 스텁할 수 있다).
 */
export async function sendRequest<T>(request: HttpRequest): Promise<T | undefined> {
  const {
    url,
    method = 'GET',
    query,
    body,
    token,
    signal,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = request;

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  // 이미 취소된 요청은 보내지 않는다.
  if (signal?.aborted) throw signal.reason;

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const onCallerAbort = () => controller.abort(signal?.reason);
  signal?.addEventListener('abort', onCallerAbort, { once: true });

  try {
    let response: Response;
    try {
      response = await fetch(`${url}${buildQueryString(query)}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (error) {
      if (timedOut) {
        throw new ApiError({ kind: 'timeout', message: '응답 시간이 초과됐어요.' });
      }
      if (signal?.aborted) throw signal.reason ?? error;
      throw new ApiError({ kind: 'network', message: '서버에 연결하지 못했어요.' });
    }

    let text: string;
    try {
      text = response.status === 204 ? '' : await response.text();
    } catch (error) {
      if (timedOut) throw new ApiError({ kind: 'timeout', message: '응답 시간이 초과됐어요.' });
      if (signal?.aborted) throw signal.reason ?? error;
      throw new ApiError({ kind: 'network', message: '응답을 끝까지 받지 못했어요.' });
    }

    if (!response.ok) {
      throw new ApiError({
        kind: 'http',
        status: response.status,
        code: readErrorCode(text),
        message: `요청이 실패했어요 (HTTP ${response.status}).`,
      });
    }
    if (text.trim() === '') return undefined;
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new ApiError({
        kind: 'parse',
        status: response.status,
        message: '응답을 해석하지 못했어요(JSON 이 아니에요).',
      });
    }
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onCallerAbort);
  }
}
