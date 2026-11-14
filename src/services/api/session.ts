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
  /** 그 토큰이 아직 저장된 토큰일 때만 지운다(다른 요청이 이미 새 토큰을 받았다면 건드리지 않는다). 지웠으면 true. */
  invalidate(token: string): boolean;
  /** 저장된 토큰을 지운다. */
  clear(): void;
  /** 만료되지 않은 토큰이 저장돼 있는지. 로그인도 요청도 일으키지 않는다. */
  hasSession(): boolean;
  /**
   * 시연용 데모 로그인(POST /auth/demo)으로 세션을 바꾼다. 받은 토큰과 "데모 세션" 표시를 같은 키에 저장한다.
   * 동시에 여러 번 불러도 로그인은 한 번이다. demoLoginUrl 을 넘기지 않은 세션이면 던진다.
   */
  loginDemo(role: 'OWNER'): Promise<void>;
  /** 저장된 세션이 데모 세션인지(만료되지 않았을 때만). 요청을 일으키지 않는다. */
  isDemo(): boolean;
}

interface GuestSessionOptions {
  /** 로그인 요청의 전체 주소(호스트 + /api/v1/auth/guest) */
  loginUrl: string;
  /** 데모 로그인 주소(호스트 + /api/v1/auth/demo). 없으면 loginDemo 를 쓸 수 없다. */
  demoLoginUrl?: string;
  store: TokenStore;
  now?: () => number;
  timeoutMs?: number;
}

/** 게스트 세션. 로그인 요청에는 토큰을 붙이지 않고, 401 이어도 재시도하지 않는다(재시도는 apiClient 가 요청마다 한 번만 한다). */
export function createGuestSession({
  loginUrl,
  demoLoginUrl,
  store,
  now = Date.now,
  timeoutMs,
}: GuestSessionOptions): GuestSession {
  let inflight: Promise<string> | null = null;
  let demoInflight: Promise<void> | null = null;

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
    // 게스트 로그인을 기다리는 사이 데모 로그인이 먼저 끝났다면(메인을 /?demo=owner 로 처음 열 때 동네 목록 요청이
    // 게스트 로그인을 먼저 시작한다) 데모 세션을 덮어쓰지 않는다. 덮어쓰면 공유 계정 보호(데모 표시)가 사라진다.
    const current = store.read(now());
    if (current?.demo === true) return current.token;
    store.write({ token, expiresAt: resolveExpiresAt(token, dto?.expiresIn, now()) });
    return token;
  }

  async function loginDemo(role: 'OWNER'): Promise<void> {
    if (demoLoginUrl === undefined) {
      throw new ApiError({
        kind: 'parse',
        code: 'DEMO_DISABLED',
        message: '데모 로그인을 쓸 수 없어요.',
      });
    }
    const dto = await sendRequest<AuthResponseDto>({
      url: demoLoginUrl,
      method: 'POST',
      body: { role },
      timeoutMs,
    });
    const token = typeof dto?.accessToken === 'string' ? dto.accessToken : '';
    if (token === '') {
      throw new ApiError({ kind: 'parse', message: '로그인 응답에 토큰이 없어요.' });
    }
    store.write({ token, expiresAt: resolveExpiresAt(token, dto?.expiresIn, now()), demo: true });
  }

  return {
    loginDemo(role) {
      demoInflight ??= loginDemo(role).finally(() => {
        demoInflight = null;
      });
      return demoInflight;
    },
    isDemo() {
      return store.read(now())?.demo === true;
    },
    async ensureSession() {
      const current = store.read(now());
      if (current) return current.token;
      inflight ??= login().finally(() => {
        inflight = null;
      });
      return inflight;
    },
    invalidate(token) {
      if (store.read(now())?.token !== token) return false;
      store.clear();
      return true;
    },
    clear() {
      store.clear();
    },
    hasSession() {
      return store.read(now()) !== null;
    },
  };
}
