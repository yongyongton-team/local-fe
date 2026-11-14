import { beforeEach, describe, expect, it } from 'vitest';
import { fakeJwt, jsonResponse, stubFetch, type StubCall } from '@/test/apiStub';
import { createApiClient } from './apiClient';
import type { ApiError } from './apiError';
import { createTokenStore } from './tokenStore';

const BASE = 'https://api.test';
const GUEST = '/api/v1/auth/guest';

const auth = (token: string, expiresIn = 3600) =>
  jsonResponse(200, { accessToken: token, expiresIn, isNew: true, user: { id: 1 } });

const newClient = (now = () => 1_000_000) =>
  createApiClient({ baseUrl: BASE, store: createTokenStore(), now });

/** 로그인 요청과 데이터 요청을 구분해 세는 도우미 */
const logins = (calls: StubCall[]) => calls.filter((c) => c.path === GUEST);
const failure = async (promise: Promise<unknown>): Promise<ApiError> => {
  try {
    await promise;
  } catch (error) {
    return error as ApiError;
  }
  throw new Error('거부되어야 해요');
};

beforeEach(() => localStorage.clear());

describe('토큰 부착과 지연 로그인', () => {
  it('토큰이 없으면 먼저 게스트 로그인하고, 그 토큰을 Authorization 헤더로 보낸다', async () => {
    const { calls } = stubFetch((call) =>
      call.path === GUEST ? auth('tok-1') : jsonResponse(200, { id: 7 }),
    );

    await expect(newClient().request('/me')).resolves.toEqual({ id: 7 });

    expect(calls.map((c) => [c.method, c.path, c.authorization])).toEqual([
      ['POST', GUEST, null],
      ['GET', '/api/v1/me', 'Bearer tok-1'],
    ]);
  });

  it('로그인 요청에는 본문과 토큰이 없다', async () => {
    const { calls } = stubFetch((call) =>
      call.path === GUEST ? auth('tok-1') : jsonResponse(200, {}),
    );

    await newClient().request('/me');

    expect(calls[0]).toMatchObject({ authorization: null, body: null, contentType: null });
  });

  it('토큰이 있으면 로그인하지 않고 같은 토큰을 다시 쓴다', async () => {
    const { calls } = stubFetch((call) =>
      call.path === GUEST ? auth('tok-1') : jsonResponse(200, {}),
    );
    const client = newClient();

    await client.request('/me');
    await client.request('/me');
    await client.request('/me');

    expect(logins(calls)).toHaveLength(1);
    expect(calls.filter((c) => c.authorization === 'Bearer tok-1')).toHaveLength(3);
  });

  it('auth: false 요청은 토큰을 붙이지 않고 로그인도 일으키지 않는다', async () => {
    const { calls } = stubFetch(() => jsonResponse(200, { status: 'UP' }));

    await newClient().request('/health', { auth: false });

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ path: '/api/v1/health', authorization: null });
  });

  it('동시에 여러 요청이 나가도 로그인은 한 번만 하고 모두 같은 토큰을 쓴다', async () => {
    const { calls } = stubFetch(async (call) => {
      if (call.path === GUEST) {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return auth('tok-1');
      }
      return jsonResponse(200, {});
    });
    const client = newClient();

    await Promise.all([1, 2, 3, 4, 5].map(() => client.request('/me')));

    expect(logins(calls)).toHaveLength(1);
    const dataCalls = calls.filter((c) => c.path !== GUEST);
    expect(dataCalls).toHaveLength(5);
    expect(new Set(dataCalls.map((c) => c.authorization))).toEqual(new Set(['Bearer tok-1']));
  });

  it('로그인이 실패하면 ApiError 이고 데이터 요청은 보내지 않는다(실패한 로그인은 다음에 다시 시도한다)', async () => {
    let failLogin = true;
    const { calls } = stubFetch((call) => {
      if (call.path === GUEST) return failLogin ? jsonResponse(500, {}) : auth('tok-2');
      return jsonResponse(200, { id: 1 });
    });
    const client = newClient();

    expect(await failure(client.request('/me'))).toMatchObject({ kind: 'http', status: 500 });
    expect(calls.filter((c) => c.path !== GUEST)).toHaveLength(0);

    failLogin = false;
    await expect(client.request('/me')).resolves.toEqual({ id: 1 });
    expect(logins(calls)).toHaveLength(2);
  });

  it('로그인 응답에 토큰이 없으면 parse 오류다', async () => {
    stubFetch(() => jsonResponse(200, { expiresIn: 10 }));

    expect(await failure(newClient().request('/me'))).toMatchObject({ kind: 'parse' });
  });
});

describe('401 처리', () => {
  it('401 이면 토큰을 지우고 한 번 재로그인해서 새 토큰으로 한 번만 재시도한다', async () => {
    let logged = 0;
    const { calls } = stubFetch((call) => {
      if (call.path === GUEST) return auth(`tok-${++logged}`);
      return call.authorization === 'Bearer tok-1'
        ? jsonResponse(401, {})
        : jsonResponse(200, { id: 9 });
    });

    await expect(newClient().request('/me')).resolves.toEqual({ id: 9 });

    expect(calls.map((c) => [c.path, c.authorization])).toEqual([
      [GUEST, null],
      ['/api/v1/me', 'Bearer tok-1'],
      [GUEST, null],
      ['/api/v1/me', 'Bearer tok-2'],
    ]);
  });

  it('재시도도 401 이면 ApiError 로 끝나고 더 시도하지 않는다(무한 루프 없음)', async () => {
    let logged = 0;
    const { calls } = stubFetch((call) =>
      call.path === GUEST ? auth(`tok-${++logged}`) : jsonResponse(401, { code: 'UNAUTHORIZED' }),
    );

    const error = await failure(newClient().request('/me'));

    expect(error).toMatchObject({ kind: 'http', status: 401, code: 'UNAUTHORIZED' });
    expect(logins(calls)).toHaveLength(2);
    expect(calls.filter((c) => c.path === '/api/v1/me')).toHaveLength(2);
  });

  it('재시도도 401 이면 그 토큰을 지워 다음 요청은 새로 로그인한다', async () => {
    let logged = 0;
    const { calls } = stubFetch((call) =>
      call.path === GUEST
        ? auth(`tok-${++logged}`)
        : call.authorization === 'Bearer tok-3'
          ? jsonResponse(200, {})
          : jsonResponse(401, {}),
    );
    const client = newClient();

    await failure(client.request('/me')); // tok-1 401 → tok-2 401
    await expect(client.request('/me')).resolves.toEqual({});

    expect(logins(calls)).toHaveLength(3);
    // 401 을 받은 두 번째 토큰은 다시 쓰지 않는다(재시도 한 번뿐이고, 그 뒤 요청은 새 토큰으로 시작한다).
    expect(calls.filter((c) => c.authorization === 'Bearer tok-2')).toHaveLength(1);
  });

  it('401 이 아닌 오류(403, 500)는 재로그인 없이 그대로 던진다', async () => {
    const { calls } = stubFetch((call) =>
      call.path === GUEST ? auth('tok-1') : jsonResponse(403, { code: 'FORBIDDEN' }),
    );

    expect(await failure(newClient().request('/me'))).toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
    });

    expect(logins(calls)).toHaveLength(1);
    expect(calls.filter((c) => c.path === '/api/v1/me')).toHaveLength(1);
  });

  it('동시 요청이 모두 401 을 받아도 재로그인은 한 번이다', async () => {
    let logged = 0;
    const { calls } = stubFetch(async (call) => {
      if (call.path === GUEST) {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return auth(`tok-${++logged}`);
      }
      return call.authorization === 'Bearer tok-1' ? jsonResponse(401, {}) : jsonResponse(200, {});
    });
    const client = newClient();

    await Promise.all([1, 2, 3].map(() => client.request('/me')));

    expect(logins(calls)).toHaveLength(2);
    expect(calls.filter((c) => c.authorization === 'Bearer tok-2')).toHaveLength(3);
  });

  it('auth: false 요청의 401 은 재로그인하지 않는다', async () => {
    const { calls } = stubFetch(() => jsonResponse(401, {}));

    expect(await failure(newClient().request('/health', { auth: false }))).toMatchObject({
      status: 401,
    });
    expect(calls).toHaveLength(1);
  });
});

describe('401 처리: 데모 세션 유지', () => {
  const DEMO = '/api/v1/auth/demo';
  const KEY = 'yyt.session';
  const storeDemo = (token = 'tok-demo-old') =>
    localStorage.setItem(KEY, JSON.stringify({ token, expiresAt: 1_000_000 + 1e7, demo: true }));
  const storeGuest = (token = 'tok-guest-old') =>
    localStorage.setItem(KEY, JSON.stringify({ token, expiresAt: 1_000_000 + 1e7 }));
  const stored = () => JSON.parse(localStorage.getItem(KEY) ?? '{}');
  const demoLogins = (calls: StubCall[]) => calls.filter((c) => c.path === DEMO);

  it('데모 세션이 401 이면 게스트가 아니라 같은 역할(OWNER)로 데모 로그인을 다시 하고 그 토큰으로 한 번 재시도한다', async () => {
    storeDemo();
    const { calls } = stubFetch((call) => {
      if (call.path === DEMO) return auth('tok-demo-new');
      return call.authorization === 'Bearer tok-demo-old'
        ? jsonResponse(401, {})
        : jsonResponse(200, { id: 9 });
    });

    await expect(newClient().request('/me')).resolves.toEqual({ id: 9 });

    expect(calls.map((c) => [c.path, c.authorization])).toEqual([
      ['/api/v1/me', 'Bearer tok-demo-old'],
      [DEMO, null],
      ['/api/v1/me', 'Bearer tok-demo-new'],
    ]);
    expect(JSON.parse(demoLogins(calls)[0]?.body ?? '{}')).toEqual({ role: 'OWNER' });
    expect(logins(calls)).toHaveLength(0);
    expect(stored()).toMatchObject({ token: 'tok-demo-new', demo: true });
  });

  it('데모 재로그인이 실패하면 지금처럼 일반 게스트로 돌아가 재시도한다(데모 표시는 사라진다)', async () => {
    storeDemo();
    const { calls } = stubFetch((call) => {
      if (call.path === DEMO) return jsonResponse(500, {});
      if (call.path === GUEST) return auth('tok-guest-new');
      return call.authorization === 'Bearer tok-demo-old'
        ? jsonResponse(401, {})
        : jsonResponse(200, { id: 9 });
    });

    await expect(newClient().request('/me')).resolves.toEqual({ id: 9 });

    expect(calls.map((c) => [c.path, c.authorization])).toEqual([
      ['/api/v1/me', 'Bearer tok-demo-old'],
      [DEMO, null],
      [GUEST, null],
      ['/api/v1/me', 'Bearer tok-guest-new'],
    ]);
    expect(stored()).toMatchObject({ token: 'tok-guest-new' });
    expect(stored()).not.toHaveProperty('demo');
  });

  it('데모 재로그인 요청이 네트워크로 실패해도 게스트로 돌아간다', async () => {
    storeDemo();
    stubFetch((call) => {
      if (call.path === DEMO) throw new TypeError('network');
      if (call.path === GUEST) return auth('tok-guest-new');
      return call.authorization === 'Bearer tok-demo-old'
        ? jsonResponse(401, {})
        : jsonResponse(200, { id: 9 });
    });

    await expect(newClient().request('/me')).resolves.toEqual({ id: 9 });
    expect(stored()).not.toHaveProperty('demo');
  });

  it('데모 재로그인 뒤 재시도도 401 이면 ApiError 로 끝나고 더 시도하지 않는다(재시도는 한 번)', async () => {
    storeDemo();
    const { calls } = stubFetch((call) =>
      call.path === DEMO ? auth('tok-demo-new') : jsonResponse(401, { code: 'UNAUTHORIZED' }),
    );

    const error = await failure(newClient().request('/me'));

    expect(error).toMatchObject({ kind: 'http', status: 401, code: 'UNAUTHORIZED' });
    expect(demoLogins(calls)).toHaveLength(1);
    expect(calls.filter((c) => c.path === '/api/v1/me')).toHaveLength(2);
    expect(logins(calls)).toHaveLength(0);
  });

  it('일반 게스트의 401 흐름은 그대로다(데모 로그인을 부르지 않고 게스트로 재로그인한다)', async () => {
    storeGuest();
    const { calls } = stubFetch((call) => {
      if (call.path === GUEST) return auth('tok-guest-new');
      return call.authorization === 'Bearer tok-guest-old'
        ? jsonResponse(401, {})
        : jsonResponse(200, { id: 9 });
    });

    await expect(newClient().request('/me')).resolves.toEqual({ id: 9 });

    expect(demoLogins(calls)).toHaveLength(0);
    expect(calls.map((c) => [c.path, c.authorization])).toEqual([
      ['/api/v1/me', 'Bearer tok-guest-old'],
      [GUEST, null],
      ['/api/v1/me', 'Bearer tok-guest-new'],
    ]);
    expect(stored()).not.toHaveProperty('demo');
  });

  it('데모 세션에서 동시 요청이 모두 401 을 받아도 데모 재로그인은 한 번이고 모두 새 데모 토큰으로 재시도한다(게스트 로그인 없음)', async () => {
    storeDemo();
    const { calls } = stubFetch(async (call) => {
      if (call.path === DEMO) {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return auth('tok-demo-new');
      }
      return call.authorization === 'Bearer tok-demo-old'
        ? jsonResponse(401, {})
        : jsonResponse(200, {});
    });
    const client = newClient();

    await Promise.all([1, 2, 3].map(() => client.request('/me')));

    expect(demoLogins(calls)).toHaveLength(1);
    expect(logins(calls)).toHaveLength(0);
    expect(calls.filter((c) => c.authorization === 'Bearer tok-demo-new')).toHaveLength(3);
    expect(stored()).toMatchObject({ token: 'tok-demo-new', demo: true });
  });

  it('auth: false 요청의 401 은 데모 세션이어도 재로그인하지 않는다', async () => {
    storeDemo();
    const { calls } = stubFetch(() => jsonResponse(401, {}));

    await failure(newClient().request('/health', { auth: false }));

    expect(calls).toHaveLength(1);
    expect(stored()).toMatchObject({ token: 'tok-demo-old', demo: true });
  });
});

describe('세션 보관과 만료', () => {
  it('새로고침·탭을 닫은 뒤에도(새 클라이언트) localStorage 의 토큰을 복원해 로그인하지 않는다', async () => {
    const { calls } = stubFetch((call) =>
      call.path === GUEST ? auth('tok-1') : jsonResponse(200, {}),
    );
    await newClient().request('/me');

    await newClient().request('/me'); // 새 클라이언트 = 새로고침

    expect(logins(calls)).toHaveLength(1);
    expect(calls.at(-1)?.authorization).toBe('Bearer tok-1');
  });

  it('만료 시각이 지난 토큰은 쓰지 않고 새로 로그인한다', async () => {
    let now = 1_000_000;
    let logged = 0;
    const { calls } = stubFetch((call) =>
      call.path === GUEST ? auth(`tok-${++logged}`, 100) : jsonResponse(200, {}),
    );
    const client = newClient(() => now);
    await client.request('/me');

    now += 200 * 1000; // expiresIn 100 + 여유 시간을 넘긴다
    await client.request('/me');

    expect(logins(calls)).toHaveLength(2);
    expect(calls.at(-1)?.authorization).toBe('Bearer tok-2');
  });

  it('JWT 의 exp 가 있으면 expiresIn 보다 exp 를 만료 시각으로 쓴다', async () => {
    let now = 1_000_000;
    const exp = Math.floor(now / 1000) + 3600;
    const { calls } = stubFetch((call) =>
      call.path === GUEST ? auth(fakeJwt({ exp, iat: exp - 3600 }), 1) : jsonResponse(200, {}),
    );
    const client = newClient(() => now);
    await client.request('/me');

    now += 60_000; // expiresIn(1)만 믿었다면 이미 만료됐을 시간
    await client.request('/me');

    expect(logins(calls)).toHaveLength(1);
  });

  it('localStorage 가 막혀 있어도(예외) 메모리만으로 로그인 한 번에 여러 요청이 동작한다', async () => {
    const blocked = {
      getItem: () => {
        throw new DOMException('blocked', 'SecurityError');
      },
      setItem: () => {
        throw new DOMException('blocked', 'SecurityError');
      },
      removeItem: () => {
        throw new DOMException('blocked', 'SecurityError');
      },
    } as unknown as Storage;
    const { calls } = stubFetch((call) =>
      call.path === GUEST ? auth('tok-1') : jsonResponse(200, { id: 1 }),
    );
    const client = createApiClient({
      baseUrl: BASE,
      store: createTokenStore(() => blocked),
    });

    await expect(client.request('/me')).resolves.toEqual({ id: 1 });
    await expect(client.request('/me')).resolves.toEqual({ id: 1 });

    expect(logins(calls)).toHaveLength(1);
    expect(calls.at(-1)?.authorization).toBe('Bearer tok-1');
  });

  it('요청 경로·쿼리·본문을 /api/v1 아래로 보낸다', async () => {
    const { calls } = stubFetch((call) =>
      call.path === GUEST ? auth('tok-1') : jsonResponse(201, { ok: true }),
    );

    await newClient().request('/requests', {
      method: 'POST',
      query: { dryRun: false },
      body: { a: 1 },
    });

    expect(calls.at(-1)).toMatchObject({
      method: 'POST',
      path: '/api/v1/requests?dryRun=false',
      contentType: 'application/json',
      body: '{"a":1}',
    });
  });

  it('204 응답은 undefined 를 돌려준다', async () => {
    stubFetch((call) =>
      call.path === GUEST ? auth('tok-1') : new Response(null, { status: 204 }),
    );

    await expect(newClient().request('/requests/1', { method: 'DELETE' })).resolves.toBeUndefined();
  });
});
