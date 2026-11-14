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
 *   지운 토큰이 데모 세션이었으면 게스트 대신 같은 역할(지금은 사장님)로 데모 로그인을 다시 해서 데모 상태를 유지한다.
 *   데모 재로그인이 실패하면 일반 게스트로 돌아간다.
 */
export function createApiClient({
  baseUrl,
  store = createTokenStore(),
  now = Date.now,
}: ApiClientOptions): ApiClient {
  const root = `${baseUrl}${API_BASE_PATH}`;
  const session = createGuestSession({
    loginUrl: `${root}/auth/guest`,
    demoLoginUrl: `${root}/auth/demo`,
    store,
    now,
  });

  /** 진행 중인 데모 재로그인(401 복구). 없으면 null. */
  let demoRecovery: Promise<void> | null = null;

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
    // 버린 토큰이 데모 세션이었으면 데모 로그인으로 다시 들어가 공유 계정 보호(데모 표시)가 풀리지 않게 한다.
    const wasDemo = session.isDemo();
    const cleared = session.invalidate(token);
    if (wasDemo && cleared) {
      // 데모 세션은 사장님(OWNER) 역할뿐이다(loginDemo). 실패하면 아래 ensureSession 이 일반 게스트로 로그인한다.
      demoRecovery = session
        .loginDemo('OWNER')
        .catch(() => undefined)
        .finally(() => {
          demoRecovery = null;
        });
    }
    // 같은 토큰으로 동시에 401 을 받은 다른 요청도 데모 재로그인이 끝나길 기다린다(그 사이에 게스트로 로그인하지 않도록).
    if (demoRecovery) await demoRecovery;
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
