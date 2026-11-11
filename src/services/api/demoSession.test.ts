import { beforeEach, describe, expect, it } from 'vitest';
import { jsonResponse, stubFetch, fakeJwt } from '@/test/apiStub';
import { createApiAuthService } from './apiAuthService';
import { createApiClient } from './apiClient';
import { createApiMeService } from './apiMeService';
import { createApiRequestServices } from './apiRequestServices';
import { isDemoLoginEnabled } from './config';
import { assertNotDemoSession } from './demoGuard';
import { ApiError } from './apiError';
import {
  DEMO_WRITE_BLOCKED_MESSAGE,
  FALLBACK_ERROR_MESSAGE,
  describeApiError,
} from './errorMessages';
import { createGuestSession } from './session';
import { createTokenStore } from './tokenStore';

const NOW = 1_000_000;
const DEMO = '/api/v1/auth/demo';
const GUEST = '/api/v1/auth/guest';
const KEY = 'yyt.session';

const demoToken = () => fakeJwt({ iat: NOW / 1000, exp: NOW / 1000 + 3600 });
const newSession = () =>
  createGuestSession({
    loginUrl: `https://api.test${GUEST}`,
    demoLoginUrl: `https://api.test${DEMO}`,
    store: createTokenStore(),
    now: () => NOW,
  });
const newClient = () =>
  createApiClient({ baseUrl: 'https://api.test', store: createTokenStore(), now: () => NOW });

beforeEach(() => localStorage.clear());

describe('isDemoLoginEnabled', () => {
  it.each([
    ['api', 'true', true],
    ['api', ' true ', true],
    ['api', 'false', false],
    ['api', '', false],
    ['api', undefined, false],
    ['api', 'TRUE', false],
    ['api', '1', false],
    ['mock', 'true', false],
  ] as const)('%s 모드, 값 %j → %s', (source, raw, expected) => {
    expect(isDemoLoginEnabled(source, raw)).toBe(expected);
  });
});

describe('GuestSession 데모 로그인', () => {
  it('POST /auth/demo 를 {role: OWNER} 로(토큰 없이) 부르고 토큰과 데모 표시를 같은 키에 저장한다', async () => {
    const token = demoToken();
    const { calls } = stubFetch(() =>
      jsonResponse(200, {
        accessToken: token,
        expiresIn: 3600,
        isNew: false,
        user: { role: 'OWNER' },
      }),
    );
    const session = newSession();

    await session.loginDemo('OWNER');

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ method: 'POST', path: DEMO, authorization: null });
    expect(JSON.parse(calls[0]?.body ?? '{}')).toEqual({ role: 'OWNER' });
    const stored = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    expect(stored).toMatchObject({ token, demo: true });
    expect(Object.keys(localStorage)).toEqual([KEY]);
    expect(session.isDemo()).toBe(true);
    expect(session.hasSession()).toBe(true);
  });

  it('동시에 여러 번 불러도 로그인은 한 번이다', async () => {
    const { calls } = stubFetch(() =>
      jsonResponse(200, { accessToken: demoToken(), expiresIn: 3600 }),
    );
    const session = newSession();

    await Promise.all([session.loginDemo('OWNER'), session.loginDemo('OWNER')]);

    expect(calls).toHaveLength(1);
  });

  it('데모 세션의 토큰으로는 게스트 로그인을 다시 하지 않는다', async () => {
    const { calls } = stubFetch(() =>
      jsonResponse(200, { accessToken: demoToken(), expiresIn: 3600 }),
    );
    const session = newSession();
    await session.loginDemo('OWNER');

    await session.ensureSession();

    expect(calls.filter((c) => c.path === GUEST)).toHaveLength(0);
  });

  it('토큰이 지워지고 새 게스트가 되면 데모 표시도 사라진다(공유 계정 보호가 새 게스트를 막지 않는다)', async () => {
    stubFetch((call) =>
      jsonResponse(200, {
        accessToken: call.path === DEMO ? demoToken() : fakeJwt({ exp: NOW / 1000 + 3600 }),
        expiresIn: 3600,
      }),
    );
    const session = newSession();
    await session.loginDemo('OWNER');
    expect(session.isDemo()).toBe(true);

    session.clear();
    expect(session.isDemo()).toBe(false);
    await session.ensureSession();

    expect(session.isDemo()).toBe(false);
    expect(JSON.parse(localStorage.getItem(KEY) ?? '{}')).not.toHaveProperty('demo');
  });

  it('게스트 로그인이 진행 중일 때 데모 로그인이 먼저 끝나도 데모 세션을 덮어쓰지 않는다', async () => {
    let finishGuest: (r: Response) => void = () => undefined;
    const demo = demoToken();
    stubFetch((call) =>
      call.path === GUEST
        ? new Promise<Response>((resolve) => (finishGuest = resolve))
        : jsonResponse(200, { accessToken: demo, expiresIn: 3600 }),
    );
    const session = newSession();

    const guest = session.ensureSession(); // 토큰이 없어 게스트 로그인이 시작된다(응답은 아직)
    await session.loginDemo('OWNER');
    finishGuest(
      jsonResponse(200, { accessToken: fakeJwt({ exp: NOW / 1000 + 3600 }), expiresIn: 3600 }),
    );

    await expect(guest).resolves.toBe(demo);
    expect(session.isDemo()).toBe(true);
    expect(JSON.parse(localStorage.getItem(KEY) ?? '{}')).toMatchObject({
      token: demo,
      demo: true,
    });
  });

  it('반대로 데모 로그인이 진행 중일 때 게스트 로그인이 먼저 끝나면 데모 로그인이 이긴다', async () => {
    let finishDemo: (r: Response) => void = () => undefined;
    const demo = demoToken();
    stubFetch((call) =>
      call.path === DEMO
        ? new Promise<Response>((resolve) => (finishDemo = resolve))
        : jsonResponse(200, { accessToken: fakeJwt({ exp: NOW / 1000 + 3600 }), expiresIn: 3600 }),
    );
    const session = newSession();

    const entering = session.loginDemo('OWNER');
    await session.ensureSession();
    finishDemo(jsonResponse(200, { accessToken: demo, expiresIn: 3600 }));
    await entering;

    expect(session.isDemo()).toBe(true);
    expect(JSON.parse(localStorage.getItem(KEY) ?? '{}')).toMatchObject({
      token: demo,
      demo: true,
    });
  });

  it('만료된 데모 세션은 데모가 아니다', () => {
    localStorage.setItem(KEY, JSON.stringify({ token: 'tok', expiresAt: NOW - 1, demo: true }));

    expect(newSession().isDemo()).toBe(false);
  });

  it('응답에 토큰이 없으면 저장하지 않고 parse 오류다. 데모 주소가 없으면 던진다', async () => {
    stubFetch(() => jsonResponse(200, {}));

    await expect(newSession().loginDemo('OWNER')).rejects.toMatchObject({ kind: 'parse' });
    expect(localStorage.getItem(KEY)).toBeNull();

    const noUrl = createGuestSession({
      loginUrl: `https://api.test${GUEST}`,
      store: createTokenStore(),
      now: () => NOW,
    });
    await expect(noUrl.loginDemo('OWNER')).rejects.toMatchObject({ code: 'DEMO_DISABLED' });
  });

  it('서버 오류는 ApiError 로 던지고 세션을 바꾸지 않는다', async () => {
    localStorage.setItem(KEY, JSON.stringify({ token: 'old-guest', expiresAt: NOW + 1e7 }));
    stubFetch(() => jsonResponse(500, { code: 'X' }));
    const session = newSession();

    await expect(session.loginDemo('OWNER')).rejects.toMatchObject({ kind: 'http', status: 500 });

    expect(session.isDemo()).toBe(false);
    expect(JSON.parse(localStorage.getItem(KEY) ?? '{}').token).toBe('old-guest');
  });

  it('저장소의 demo 값이 true 가 아니면(깨진 값) 세션으로 읽지 않는다', () => {
    localStorage.setItem(KEY, JSON.stringify({ token: 'tok', expiresAt: NOW + 1e7, demo: 'yes' }));

    expect(createTokenStore().read(NOW)).toBeNull();
  });
});

describe('데모 세션 보호', () => {
  const putMe = () => stubFetch(() => jsonResponse(200, { id: 1, role: 'RESIDENT' }));
  const storeDemo = () =>
    localStorage.setItem(
      KEY,
      JSON.stringify({ token: 'tok-demo', expiresAt: NOW + 1e7, demo: true }),
    );

  it('assertNotDemoSession: 데모 세션이면 DEMO_SESSION 으로 던진다', () => {
    expect(() => assertNotDemoSession({ isDemo: () => true })).toThrow(
      expect.objectContaining({ code: 'DEMO_SESSION' }),
    );
    expect(() => assertNotDemoSession({ isDemo: () => false })).not.toThrow();
  });

  it('PUT /me(saveSelection)는 데모 세션에서 어떤 역할로도 요청 없이 막힌다', async () => {
    const { fn } = putMe();
    storeDemo();
    const client = newClient();
    const service = createApiMeService(() => client);

    for (const role of ['resident', 'merchant', 'founder'] as const) {
      await expect(service.saveSelection(role, '22')).rejects.toMatchObject({
        code: 'DEMO_SESSION',
      });
    }
    expect(fn).not.toHaveBeenCalled();
  });

  it('일반 세션에서는 PUT /me 가 그대로 나간다', async () => {
    localStorage.setItem(KEY, JSON.stringify({ token: 'tok-guest', expiresAt: NOW + 1e7 }));
    const { calls } = putMe();
    const client = newClient();

    await createApiMeService(() => client).saveSelection('resident', '22');

    expect(calls.map((c) => [c.method, c.path])).toEqual([['PUT', '/api/v1/me']]);
  });

  it('요청 생성(POST /requests)도 데모 세션에서는 요청 없이 막힌다', async () => {
    const { fn } = putMe();
    storeDemo();
    const client = newClient();
    const { requestSubmitter } = createApiRequestServices({
      listCategories: async () => [],
      getClient: () => client,
    });

    await expect(
      requestSubmitter.submit({
        neighborhoodId: '22',
        categoryId: '7',
        detail: '',
        conditions: [],
        visitTimes: ['weekend'],
        visitFrequency: 'weekly',
      }),
    ).rejects.toMatchObject({ code: 'DEMO_SESSION' });
    expect(fn).not.toHaveBeenCalled();
  });

  it('요청 삭제(DELETE /requests/{id})도 데모 세션에서는 요청 없이 막힌다', async () => {
    const { fn } = putMe();
    storeDemo();
    const client = newClient();
    const { myRequestService } = createApiRequestServices({
      listCategories: async () => [],
      getClient: () => client,
    });

    await expect(myRequestService.deleteRequest('351')).rejects.toMatchObject({
      code: 'DEMO_SESSION',
    });
    expect(fn).not.toHaveBeenCalled();
  });

  it('describeApiError: DEMO_SESSION 은 임시 안내 문구다(다른 parse 오류는 마지막 문구)', () => {
    expect(DEMO_WRITE_BLOCKED_MESSAGE).toBe(
      '데모 계정은 사장님 화면만 볼 수 있어요. 나가려면 주소 끝에 ?demo=off를 붙여 주세요.',
    );
    expect(
      describeApiError(new ApiError({ kind: 'parse', code: 'DEMO_SESSION', message: 'x' })),
    ).toBe(DEMO_WRITE_BLOCKED_MESSAGE);
    expect(describeApiError(new ApiError({ kind: 'parse', message: 'x' }))).toBe(
      FALLBACK_ERROR_MESSAGE,
    );
  });
});

describe('authService(API)', () => {
  it('플래그가 꺼져 있으면 데모 로그인을 하지 않고 던진다(요청 없음)', async () => {
    const { fn } = stubFetch(() => jsonResponse(200, {}));
    const client = newClient();
    const auth = createApiAuthService(() => client, false);

    expect(auth.demoLoginEnabled).toBe(false);
    await expect(auth.startDemoSession()).rejects.toMatchObject({ code: 'DEMO_DISABLED' });
    expect(fn).not.toHaveBeenCalled();
  });

  it('플래그가 켜져 있으면 로그인하고 데모 세션이 되며, 종료하면 토큰과 표시가 지워진다', async () => {
    stubFetch(() => jsonResponse(200, { accessToken: demoToken(), expiresIn: 3600 }));
    const client = newClient();
    const auth = createApiAuthService(() => client, true);

    await auth.startDemoSession();
    expect(auth.isDemoSession()).toBe(true);

    auth.endDemoSession();

    expect(auth.isDemoSession()).toBe(false);
    expect(localStorage.getItem(KEY)).toBeNull();
  });
});
