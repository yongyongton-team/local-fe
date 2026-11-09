import { ApiError } from './apiError';
import type { AuthResponseDto } from './dto';
import { sendRequest } from './http';
import { readJwtTimes } from './jwt';
import type { TokenStore } from './tokenStore';

/**
 * expiresIn 의 단위(ms). 명세에 단위가 없어 실제 서버가 준 JWT 에서 exp 와 iat 의 차이를 expiresIn 과 견줘 추정했다:
 * 둘이 같아서(2,592,000) 초 단위(30일)로 본다. 만료 시각은 JWT 의 exp 를 우선 쓰므로 이 값은 exp 를 읽을 수 없을 때의 대체 값이다.
 */
export const EXPIRES_IN_UNIT_MS = 1000;

/** [임시] 만료 직전의 토큰을 쓰다 401 을 받지 않도록, 만료 시각보다 이만큼 일찍 만료된 것으로 본다. */
export const EXPIRY_MARGIN_MS = 30_000;

/** 만료 시각(epoch ms). JWT 의 exp(초)를 우선하고, 없으면 expiresIn 으로 계산한다. 알 수 없으면 undefined. */
export function resolveExpiresAt(
  token: string,
  expiresIn: number | null | undefined,
  now: number,
): number | undefined {
  const { exp } = readJwtTimes(token);
  const expiresAt =
    exp !== undefined
      ? exp * 1000
      : typeof expiresIn === 'number' && Number.isFinite(expiresIn)
        ? now + expiresIn * EXPIRES_IN_UNIT_MS
        : undefined;
  return expiresAt === undefined ? undefined : expiresAt - EXPIRY_MARGIN_MS;
}

export interface GuestSession {
  /** 토큰이 없을 때만 게스트 로그인한다. 동시에 여러 번 불러도 로그인은 한 번이다. 토큰 값을 돌려준다. */
  ensureSession(): Promise<string>;
  /** 그 토큰이 아직 저장된 토큰일 때만 지운다(다른 요청이 이미 새 토큰을 받았다면 건드리지 않는다). */
  invalidate(token: string): void;
  /** 저장된 토큰을 지운다. */
  clear(): void;
  /** 만료되지 않은 토큰이 저장돼 있는지. 로그인도 요청도 일으키지 않는다. */
  hasSession(): boolean;
}

interface GuestSessionOptions {
  /** 로그인 요청의 전체 주소(호스트 + /api/v1/auth/guest) */
  loginUrl: string;
  store: TokenStore;
  now?: () => number;
  timeoutMs?: number;
}

/** 게스트 세션. 로그인 요청에는 토큰을 붙이지 않고, 401 이어도 재시도하지 않는다(재시도는 apiClient 가 요청마다 한 번만 한다). */
export function createGuestSession({
  loginUrl,
  store,
  now = Date.now,
  timeoutMs,
}: GuestSessionOptions): GuestSession {
  let inflight: Promise<string> | null = null;

  async function login(): Promise<string> {
    const dto = await sendRequest<AuthResponseDto>({
      url: loginUrl,
      method: 'POST',
      timeoutMs,
    });
    const token = typeof dto?.accessToken === 'string' ? dto.accessToken : '';
    if (token === '') {
      throw new ApiError({ kind: 'parse', message: '로그인 응답에 토큰이 없어요.' });
    }
    store.write({ token, expiresAt: resolveExpiresAt(token, dto?.expiresIn, now()) });
    return token;
  }

  return {
    async ensureSession() {
      const current = store.read(now());
      if (current) return current.token;
      inflight ??= login().finally(() => {
        inflight = null;
      });
      return inflight;
    },
    invalidate(token) {
      if (store.read(now())?.token === token) store.clear();
    },
    clear() {
      store.clear();
    },
    hasSession() {
      return store.read(now()) !== null;
    },
  };
}
