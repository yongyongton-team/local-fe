import { beforeEach, describe, expect, it } from 'vitest';
import { mockDemandService } from '@/services/mockDemandService';
import { jsonResponse, stubFetch } from '@/test/apiStub';
import { createApiClient } from './apiClient';
import { createApiDemandService } from './apiDemandService';
import { createApiMeService } from './apiMeService';
import { createTokenStore } from './tokenStore';

const GUEST = '/api/v1/auth/guest';
const newClient = () =>
  createApiClient({ baseUrl: 'https://api.test', store: createTokenStore(), now: () => 1_000_000 });

const login = () => jsonResponse(200, { accessToken: 'tok-1', expiresIn: 3600, isNew: true });

beforeEach(() => localStorage.clear());

describe('createApiDemandService', () => {
  it('GET /dongs 를 불러 도메인 Neighborhood[] 로 바꾼다(숫자 id → 문자열, gu → district)', async () => {
    const { calls } = stubFetch((call) =>
      call.path === GUEST
        ? login()
        : jsonResponse(200, [
            { id: 22, name: '구성동', gu: '기흥구' },
            { id: 4, name: '남사읍', gu: '처인구' },
          ]),
    );
    const client = newClient();
    const service = createApiDemandService(mockDemandService, () => client);

    await expect(service.listNeighborhoods()).resolves.toEqual([
      { id: '22', district: '기흥구', name: '구성동' },
      { id: '4', district: '처인구', name: '남사읍' },
    ]);

    expect(calls.map((c) => [c.method, c.path, c.authorization])).toEqual([
      ['POST', GUEST, null],
      ['GET', '/api/v1/dongs', 'Bearer tok-1'],
    ]);
  });

  it('GET /categories 를 불러 도메인 StoreCategory[] 로 바꾼다(표 문구, 이름 대체, martCheck)', async () => {
    stubFetch((call) =>
      call.path === GUEST
        ? login()
        : jsonResponse(200, [
            { id: 7, code: 'FRUIT_VEG', name: '과일·채소 가게', martCheck: true },
            { id: 30, code: 'FLOWER_SHOP', name: '꽃집', martCheck: false },
          ]),
    );
    const client = newClient();
    const service = createApiDemandService(mockDemandService, () => client);

    const categories = await service.listCategories();

    expect(categories.map((c) => [c.id, c.cardTitle, c.objectPhrase, c.martCheck])).toEqual([
      ['7', '과일 / 채소 가게', '과일·채소 가게를', true],
      ['30', '꽃집', '꽃집', false],
    ]);
  });

  it('숫자가 아닌 id 가 섞여 있으면 INVALID_ID 오류다', async () => {
    stubFetch((call) =>
      call.path === GUEST
        ? login()
        : jsonResponse(200, [{ id: 'guseong', name: '구성동', gu: '기흥구' }]),
    );
    const client = newClient();
    const service = createApiDemandService(mockDemandService, () => client);

    await expect(service.listNeighborhoods()).rejects.toMatchObject({
      kind: 'parse',
      code: 'INVALID_ID',
    });
  });

  it('서버 오류는 ApiError 로 던진다', async () => {
    stubFetch((call) => (call.path === GUEST ? login() : jsonResponse(500, { code: 'X' })));
    const client = newClient();
    const service = createApiDemandService(mockDemandService, () => client);

    await expect(service.listCategories()).rejects.toMatchObject({ kind: 'http', status: 500 });
  });
});

describe('createApiMeService.saveSelection (PUT /me)', () => {
  const me = {
    id: 3,
    nickname: '게스트',
    role: 'OWNER',
    dong: { id: 28, name: '보정동', gu: '기흥구' },
    shop: null,
  };

  it('{role, dongId} 를 숫자 dongId 로 보내고 저장된 내 정보를 도메인 값으로 돌려준다', async () => {
    const { calls } = stubFetch((call) => (call.path === GUEST ? login() : jsonResponse(200, me)));
    const client = newClient();
    const service = createApiMeService(() => client);

    await expect(service.saveSelection('merchant', '28')).resolves.toEqual({
      id: 3,
      nickname: '게스트',
      role: 'merchant',
      dong: { id: 28, name: '보정동', district: '기흥구' },
      shop: null,
    });

    const put = calls.find((c) => c.method === 'PUT');
    expect(put).toMatchObject({
      path: '/api/v1/me',
      authorization: 'Bearer tok-1',
      contentType: 'application/json',
    });
    expect(JSON.parse(put!.body!)).toEqual({ role: 'OWNER', dongId: 28 });
    expect(typeof JSON.parse(put!.body!).dongId).toBe('number');
  });

  it.each([
    ['resident', 'RESIDENT'],
    ['merchant', 'OWNER'],
    ['founder', 'FOUNDER'],
  ] as const)('%s 는 %s 로 보낸다', async (role, code) => {
    const { calls } = stubFetch((call) => (call.path === GUEST ? login() : jsonResponse(200, me)));
    const client = newClient();

    await createApiMeService(() => client).saveSelection(role, '22');

    expect(JSON.parse(calls.find((c) => c.method === 'PUT')!.body!)).toEqual({
      role: code,
      dongId: 22,
    });
  });

  it('숫자가 아닌 동네 id(slug)는 요청을 보내지 않고 INVALID_ID 오류다', async () => {
    const { fn } = stubFetch(() => jsonResponse(200, me));
    const client = newClient();

    await expect(
      createApiMeService(() => client).saveSelection('resident', 'guseong'),
    ).rejects.toMatchObject({ kind: 'parse', code: 'INVALID_ID' });
    expect(fn).not.toHaveBeenCalled();
  });

  it('알 수 없는 역할은 요청을 보내지 않고 INVALID_ROLE 오류다', async () => {
    const { fn } = stubFetch(() => jsonResponse(200, me));
    const client = newClient();

    await expect(
      createApiMeService(() => client).saveSelection('admin' as never, '22'),
    ).rejects.toMatchObject({ kind: 'parse', code: 'INVALID_ROLE' });
    expect(fn).not.toHaveBeenCalled();
  });

  it('서버가 404/400 으로 거절하면 code 가 담긴 ApiError 다', async () => {
    stubFetch((call) =>
      call.path === GUEST ? login() : jsonResponse(404, { code: 'NOT_FOUND', message: '없는 동' }),
    );
    const client = newClient();

    await expect(
      createApiMeService(() => client).saveSelection('resident', '999'),
    ).rejects.toMatchObject({
      kind: 'http',
      status: 404,
      code: 'NOT_FOUND',
    });
  });

  it('savesRemotely 는 api 구현만 true 다', async () => {
    const client = newClient();
    const { mockMeService } = await import('../mockMeService');

    expect(createApiMeService(() => client).savesRemotely).toBe(true);
    expect(mockMeService.savesRemotely).toBe(false);
  });
});
