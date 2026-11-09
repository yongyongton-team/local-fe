import { isApiError } from './apiError';
import { API_BASE_PATH } from './config';
import { sendRequest, type HttpMethod, type QueryValue } from './http';
import { createGuestSession, type GuestSession } from './session';
import { createTokenStore, type TokenStore } from './tokenStore';

export interface RequestOptions {
  method?: HttpMethod;
  query?: Record<string, QueryValue | readonly QueryValue[]>;
  body?: unknown;
  signal?: AbortSignal;
  timeoutMs?: number;
  /** false 이면 토큰을 붙이지 않고 로그인도 하지 않는다. 기본 true(지연 로그인). */
  auth?: boolean;
}

export interface ApiClient {
  /** path 는 "/me" 처럼 /api/v1 뒤의 경로. 204·빈 본문이면 undefined 를 돌려준다. */
  request<T>(path: string, options?: RequestOptions): Promise<T | undefined>;
  readonly session: GuestSession;
}

interface ApiClientOptions {
  /** 호스트만(예: https://example.com). /api/v1 은 붙이지 않는다. */
  baseUrl: string;
  store?: TokenStore;
  now?: () => number;
}

/**
 * fetch 를 얇게 감싼 API 클라이언트.
 * - 인증이 필요한 요청은 토큰이 없으면 먼저 게스트 로그인한다(지연 로그인, 동시 요청의 로그인은 하나로 합친다).
 * - 401 이면 그 토큰을 지우고 한 번만 재로그인해서 재시도한다. 재시도도 401 이면 ApiError 로 끝난다(무한 루프 없음).
 */
export function createApiClient({
  baseUrl,
  store = createTokenStore(),
  now = Date.now,
}: ApiClientOptions): ApiClient {
  const root = `${baseUrl}${API_BASE_PATH}`;
  const session = createGuestSession({ loginUrl: `${root}/auth/guest`, store, now });

  const isUnauthorized = (error: unknown) =>
    isApiError(error) && error.kind === 'http' && error.status === 401;

  async function request<T>(path: string, options: RequestOptions = {}) {
    const { auth = true, ...rest } = options;
    const send = (token?: string) => sendRequest<T>({ ...rest, url: `${root}${path}`, token });

    if (!auth) return send();

    const token = await session.ensureSession();
    try {
      return await send(token);
    } catch (error) {
      if (!isUnauthorized(error)) throw error;
    }

    // 401: 이 토큰을 버리고 새로 로그인해서 한 번만 다시 보낸다.
    session.invalidate(token);
    const fresh = await session.ensureSession();
    try {
      return await send(fresh);
    } catch (error) {
      if (isUnauthorized(error)) session.invalidate(fresh);
      throw error;
    }
  }

  return { request, session };
}
