import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StoreCategory } from '@/types/domain';
import { jsonResponse, stubFetch, type StubCall } from '@/test/apiStub';
import { createApiClient } from './apiClient';
import { createApiRequestServices } from './apiRequestServices';
import { mapMyRequests } from './mappers';
import { createTokenStore } from './tokenStore';

const GUEST = '/api/v1/auth/guest';
const category = (id: string, name: string): StoreCategory => ({
  id,
  name,
  cardTitle: name,
  requestLabel: name,
  missingLabel: name,
  objectPhrase: name,
  titleLabel: name,
  martCheck: false,
});
const CATEGORIES = [category('7', '과일·채소 가게'), category('33', '태권도장')];

function newServices() {
  const client = createApiClient({
    baseUrl: 'https://api.test',
    store: createTokenStore(),
    now: () => 1_000_000,
  });
  return createApiRequestServices({
    listCategories: async () => CATEGORIES,
    getClient: () => client,
  });
}

type Handler = (call: StubCall, init: RequestInit) => Response | Promise<Response>;
function stubServer(
  routes: { parse?: Handler; create?: Handler; mine?: Handler; remove?: Handler } = {},
) {
  return stubFetch((call, init) => {
    if (call.path === GUEST) return jsonResponse(200, { accessToken: 'tok-1', expiresIn: 3600 });
    if (call.path === '/api/v1/requests/parse') {
      return routes.parse?.(call, init) ?? jsonResponse(200, { category: null, conditions: [] });
    }
    if (call.path === '/api/v1/requests' && call.method === 'POST') {
      return routes.create?.(call, init) ?? jsonResponse(201, { request: { id: 351 } });
    }
    if (call.path === '/api/v1/me/requests')
      return routes.mine?.(call, init) ?? jsonResponse(200, []);
    if (call.method === 'DELETE' && /^\/api\/v1\/requests\/[^/]+$/.test(call.path)) {
      return routes.remove?.(call, init) ?? new Response(null, { status: 204 });
    }
    return jsonResponse(404, { code: 'NOT_FOUND' });
  });
}
const callsTo = (calls: StubCall[], path: string) => calls.filter((c) => c.path === path);

beforeEach(() => localStorage.clear());

describe('요청 정리(requestSummarizer)', () => {
  it('POST /requests/parse 응답을 도메인으로 바꾼다(숫자 업종 id → 문자열, 조건은 서버 label)', async () => {
    const { calls } = stubServer({
      parse: () =>
        jsonResponse(200, {
          category: { id: 33, name: '태권도장' },
          conditions: [{ code: 'LATE_OPEN', label: '늦게까지 영업' }],
          alreadyRequested: false,
          candidates: [],
          by: 'AI',
        }),
    });

    const summary = await newServices().requestSummarizer.summarize('밤 늦게까지 하는 태권도장', {
      neighborhoodId: '1',
    });

    expect(summary).toEqual({
      categoryId: '33',
      conditions: ['늦게까지 영업'],
      alreadyRequested: false,
    });
    const [call] = callsTo(calls, '/api/v1/requests/parse');
    expect(call?.method).toBe('POST');
    expect(call?.authorization).toBe('Bearer tok-1');
    expect(JSON.parse(call?.body ?? '{}')).toEqual({
      dongId: 1,
      text: '밤 늦게까지 하는 태권도장',
    });
  });

  it.each([
    ['업종 목록에 없는 업종', { category: { id: 999, name: '모르는 업종' } }],
    ['category 가 null', { category: null }],
    ['category 가 없음', {}],
    ['업종 id 가 숫자가 아님', { category: { id: 'x', name: '태권도장' } }],
  ])('%s 이면 선택 없음(categoryId null)이다', async (_name, body) => {
    stubServer({ parse: () => jsonResponse(200, { conditions: [], ...body }) });

    await expect(
      newServices().requestSummarizer.summarize('문장', { neighborhoodId: '1' }),
    ).resolves.toEqual({ categoryId: null, conditions: [], alreadyRequested: false });
  });

  it('AI_UNAVAILABLE(502)이면 code 를 가진 ApiError 로 던진다', async () => {
    stubServer({
      parse: () => jsonResponse(502, { code: 'AI_UNAVAILABLE', message: '서버 원문' }),
    });

    await expect(
      newServices().requestSummarizer.summarize('문장', { neighborhoodId: '1' }),
    ).rejects.toMatchObject({ kind: 'http', status: 502, code: 'AI_UNAVAILABLE' });
  });

  it('동네 id 가 없거나 숫자가 아니면 요청 없이 INVALID_ID 오류다', async () => {
    const { fn } = stubServer();
    const { requestSummarizer } = newServices();

    await expect(requestSummarizer.summarize('문장')).rejects.toMatchObject({ code: 'INVALID_ID' });
    await expect(
      requestSummarizer.summarize('문장', { neighborhoodId: 'guseong' }),
    ).rejects.toMatchObject({ code: 'INVALID_ID' });
    expect(fn).not.toHaveBeenCalled();
  });

  it('응답을 기다리는 중에 abort 하면 요청이 취소된다', async () => {
    let fetchSignal: AbortSignal | null | undefined;
    const { calls } = stubServer({
      parse: (_c, init) =>
        new Promise<Response>((_resolve, reject) => {
          fetchSignal = init.signal;
          init.signal?.addEventListener('abort', () => reject(init.signal?.reason));
        }),
    });
    const controller = new AbortController();

    const outcome = newServices()
      .requestSummarizer.summarize('문장', { neighborhoodId: '1', signal: controller.signal })
      .then(
        () => 'resolved',
        (error: unknown) => error,
      );
    await vi.waitFor(() => expect(callsTo(calls, '/api/v1/requests/parse')).toHaveLength(1));
    controller.abort();

    expect(await outcome).toMatchObject({ name: 'AbortError' });
    expect(fetchSignal?.aborted).toBe(true);
  });
});

describe('요청 생성(requestSubmitter)', () => {
  const input = {
    neighborhoodId: '1',
    categoryId: '33',
    detail: '태권도장 요청',
    conditions: ['늦게까지 영업'],
    visitTimes: ['weekday-evening', 'weekend'] as const,
    visitFrequency: 'rarely' as const,
  };

  it('동네·업종 id 를 숫자로, 시간대·빈도·조건을 서버 코드로 보내고 서버에 없는 필드는 보내지 않는다', async () => {
    const { calls } = stubServer({
      parse: () =>
        jsonResponse(200, {
          category: { id: 33, name: '태권도장' },
          conditions: [{ code: 'LATE_OPEN', label: '늦게까지 영업' }],
        }),
    });
    const { requestSummarizer, requestSubmitter } = newServices();
    await requestSummarizer.summarize('문장', { neighborhoodId: '1' });

    const saved = await requestSubmitter.submit({ ...input, visitTimes: [...input.visitTimes] });

    const [call] = callsTo(calls, '/api/v1/requests');
    expect(call?.method).toBe('POST');
    expect(JSON.parse(call?.body ?? '{}')).toEqual({
      dongId: 1,
      categoryId: 33,
      text: '태권도장 요청',
      conditions: ['LATE_OPEN'],
      timeSlots: ['WEEKDAY_EVENING', 'WEEKEND'],
      frequency: 'SOMETIMES',
    });
    // 저장된 요청은 서버의 id 를 문자열로 갖는다.
    expect(saved).toMatchObject({ id: '351', neighborhoodId: '1', categoryId: '33' });
  });

  it.each([
    ['weekly', 'WEEKLY_PLUS'],
    ['monthly', 'MONTHLY_2_3'],
    ['rarely', 'SOMETIMES'],
  ] as const)('빈도 %s 는 %s 로 보낸다', async (visitFrequency, code) => {
    const { calls } = stubServer();

    await newServices().requestSubmitter.submit({
      ...input,
      conditions: [],
      visitTimes: ['weekday-day'],
      visitFrequency,
    });

    const body = JSON.parse(callsTo(calls, '/api/v1/requests')[0]?.body ?? '{}');
    expect(body.frequency).toBe(code);
    expect(body.timeSlots).toEqual(['WEEKDAY_DAY']);
  });

  it('정리 때 기록하지 않은 조건 라벨은 보내지 않는다', async () => {
    const { calls } = stubServer();

    await newServices().requestSubmitter.submit({
      ...input,
      conditions: ['모르는 조건'],
      visitTimes: [...input.visitTimes],
    });

    expect(JSON.parse(callsTo(calls, '/api/v1/requests')[0]?.body ?? '{}').conditions).toEqual([]);
  });

  it('id 가 숫자가 아니면 요청 없이 INVALID_ID 오류다', async () => {
    const { fn } = stubServer();

    await expect(
      newServices().requestSubmitter.submit({
        ...input,
        categoryId: 'fruit-vegetable',
        visitTimes: [...input.visitTimes],
      }),
    ).rejects.toMatchObject({ code: 'INVALID_ID' });
    expect(fn).not.toHaveBeenCalled();
  });

  it.each([
    [409, 'ALREADY_REQUESTED'],
    [404, 'NOT_FOUND'],
    [400, 'VALIDATION_ERROR'],
    [403, 'FORBIDDEN'],
  ])('%s %s 는 code 를 가진 ApiError 로 던진다', async (status, code) => {
    stubServer({ create: () => jsonResponse(status, { code, message: '서버 원문' }) });

    await expect(
      newServices().requestSubmitter.submit({ ...input, visitTimes: [...input.visitTimes] }),
    ).rejects.toMatchObject({ kind: 'http', status, code });
  });

  it('성공 응답에 요청 id 가 없으면 parse 오류다(만들어졌는지 알 수 없다)', async () => {
    stubServer({ create: () => jsonResponse(201, { request: {} }) });

    await expect(
      newServices().requestSubmitter.submit({ ...input, visitTimes: [...input.visitTimes] }),
    ).rejects.toMatchObject({ kind: 'parse' });
  });
});

describe('간편 요청(requestSubmitter.submitQuick)', () => {
  const INPUT = {
    neighborhoodId: '22',
    categoryId: '7',
    visitTimes: ['weekday-evening', 'weekend'] as ('weekday-evening' | 'weekend')[],
    visitFrequency: 'weekly' as const,
  };
  const quick = (input = INPUT) => newServices().requestSubmitter.submitQuick(input);
  const posts = (calls: StubCall[]) =>
    calls.filter((c) => c.method === 'POST' && c.path === '/api/v1/requests');

  it('POST /requests 본문은 {dongId, categoryId, timeSlots, frequency} 뿐이다(text·conditions 없음)', async () => {
    const { calls } = stubServer({
      create: () => jsonResponse(201, { request: { id: 351 }, count: 5, reachedGoal: false }),
    });

    await quick();

    expect(posts(calls)).toHaveLength(1);
    const body = JSON.parse(posts(calls)[0]!.body ?? '{}') as Record<string, unknown>;
    expect(body).toEqual({
      dongId: 22,
      categoryId: 7,
      timeSlots: ['WEEKDAY_EVENING', 'WEEKEND'],
      frequency: 'WEEKLY_PLUS',
    });
    expect(body).not.toHaveProperty('text');
    expect(body).not.toHaveProperty('conditions');
    expect(posts(calls)[0]).toMatchObject({ authorization: 'Bearer tok-1' });
  });

  it('응답의 reachedGoal 과 notifiedOwnerCount 를 결과로 돌려준다', async () => {
    stubServer({
      create: () =>
        jsonResponse(201, {
          request: { id: 1 },
          count: 30,
          goal: 30,
          reachedGoal: true,
          notifiedOwnerCount: 3,
        }),
    });

    await expect(quick()).resolves.toEqual({ reachedGoal: true, notifiedOwnerCount: 3 });
  });

  it.each([
    [
      'reachedGoal 이 false',
      { reachedGoal: false, notifiedOwnerCount: 3 },
      { reachedGoal: false, notifiedOwnerCount: 3 },
    ],
    ['reachedGoal 이 없음', {}, { reachedGoal: false }],
    ['reachedGoal 이 문자열', { reachedGoal: 'true' }, { reachedGoal: false }],
    ['notifiedOwnerCount 가 없음', { reachedGoal: true }, { reachedGoal: true }],
    [
      'notifiedOwnerCount 가 음수',
      { reachedGoal: true, notifiedOwnerCount: -1 },
      { reachedGoal: true },
    ],
    [
      'notifiedOwnerCount 가 소수',
      { reachedGoal: true, notifiedOwnerCount: 1.5 },
      { reachedGoal: true },
    ],
    [
      'notifiedOwnerCount 가 문자열',
      { reachedGoal: true, notifiedOwnerCount: '3' },
      { reachedGoal: true },
    ],
    [
      'notifiedOwnerCount 가 0',
      { reachedGoal: true, notifiedOwnerCount: 0 },
      { reachedGoal: true, notifiedOwnerCount: 0 },
    ],
  ])('결과 모양: %s', async (_name, response, expected) => {
    stubServer({ create: () => jsonResponse(201, { request: { id: 1 }, ...response }) });

    await expect(quick()).resolves.toEqual(expected);
  });

  it('응답 본문이 비어 있어도 reachedGoal 은 false 다', async () => {
    stubServer({ create: () => new Response(null, { status: 201 }) });

    await expect(quick()).resolves.toEqual({ reachedGoal: false });
  });

  it('409 ALREADY_REQUESTED 는 code 를 가진 ApiError 로 던진다(서버 message 는 쓰지 않는다)', async () => {
    stubServer({
      create: () => jsonResponse(409, { code: 'ALREADY_REQUESTED', message: '서버 원문' }),
    });

    await expect(quick()).rejects.toMatchObject({
      kind: 'http',
      status: 409,
      code: 'ALREADY_REQUESTED',
    });
  });

  it('동네·업종 id 가 숫자가 아니면 요청 없이 INVALID_ID 오류다', async () => {
    const { calls } = stubServer();

    await expect(quick({ ...INPUT, neighborhoodId: 'guseong' })).rejects.toMatchObject({
      code: 'INVALID_ID',
    });
    await expect(quick({ ...INPUT, categoryId: 'fruit' })).rejects.toMatchObject({
      code: 'INVALID_ID',
    });
    expect(posts(calls)).toHaveLength(0);
  });
});

describe('내 요청(myRequestService)', () => {
  const ITEM = {
    id: 351,
    dong: { id: 1, name: '포곡읍' },
    category: { id: 33, name: '태권도장' },
    count: 12,
    timeSlots: ['WEEKDAY_EVENING', 'WEEKEND'],
    frequency: 'WEEKLY_PLUS',
    createdAt: '2026-11-09T10:55:54+09:00',
    offers: [],
  };

  it('GET /me/requests 를 도메인으로 바꾼다(id 문자열, 시각 파싱, 서버에 없는 값은 비움)', async () => {
    stubServer({ mine: () => jsonResponse(200, [ITEM]) });

    const [item] = await newServices().myRequestService.listMyRequests();

    expect(item).toMatchObject({
      request: {
        id: '351',
        neighborhoodId: '1',
        categoryId: '33',
        detail: '',
        conditions: [],
        visitTimes: ['weekday-evening', 'weekend'],
        visitFrequency: 'weekly',
      },
      neighborhood: { id: '1', district: '', name: '포곡읍' },
      category: { id: '33', cardTitle: '태권도장' },
      requestCount: 12,
    });
    expect(item?.response).toBeUndefined();
    // 2026-11-09T10:55:54+09:00 = 01:55:54Z
    expect(item?.createdAt?.toISOString()).toBe('2026-11-09T01:55:54.000Z');
  });

  it('서버 순서를 그대로 둔다(createdAt 으로 다시 정렬하지 않는다)', async () => {
    const older = { ...ITEM, id: 1, createdAt: '2026-01-01T00:00:00+09:00' };
    const newer = { ...ITEM, id: 2, createdAt: '2026-06-01T00:00:00+09:00' };
    stubServer({ mine: () => jsonResponse(200, [older, newer, { ...ITEM, id: 3 }]) });

    const items = await newServices().myRequestService.listMyRequests();

    expect(items.map((i) => i.request.id)).toEqual(['1', '2', '3']);
  });

  it('빈 목록(새 게스트·만료된 토큰)은 정상이다', async () => {
    stubServer({ mine: () => jsonResponse(200, []) });

    await expect(newServices().myRequestService.listMyRequests()).resolves.toEqual([]);
  });

  it('서버 오류는 ApiError 로 던진다', async () => {
    stubServer({ mine: () => jsonResponse(500, { code: 'X' }) });

    await expect(newServices().myRequestService.listMyRequests()).rejects.toMatchObject({
      kind: 'http',
      status: 500,
    });
  });
});

describe('내 요청 삭제(myRequestService.deleteRequest)', () => {
  const remove = (id: string) => newServices().myRequestService.deleteRequest(id);
  const deletesIn = (calls: StubCall[]) => calls.filter((c) => c.method === 'DELETE');

  it('DELETE /requests/{id} 를 서버 숫자 id 로, 본문 없이 토큰과 함께 보낸다', async () => {
    const { calls } = stubServer();

    await expect(remove('351')).resolves.toBeUndefined();

    expect(deletesIn(calls)).toEqual([
      {
        method: 'DELETE',
        path: '/api/v1/requests/351',
        authorization: 'Bearer tok-1',
        contentType: null,
        body: null,
      },
    ]);
  });

  it('성공(204, 본문 없음)은 아무것도 돌려주지 않고 오류도 없다', async () => {
    stubServer({ remove: () => new Response(null, { status: 204 }) });

    await expect(remove('351')).resolves.toBeUndefined();
  });

  it('404 는 이미 지워진 요청이라 성공으로 본다(code 가 없어도 같다)', async () => {
    stubServer({ remove: () => jsonResponse(404, { code: 'NOT_FOUND', message: '서버 원문' }) });
    await expect(remove('351')).resolves.toBeUndefined();

    stubServer({ remove: () => new Response('<html>nope</html>', { status: 404 }) });
    await expect(remove('351')).resolves.toBeUndefined();
  });

  it.each([
    [403, 'FORBIDDEN'],
    [400, 'VALIDATION_ERROR'],
    [500, 'INTERNAL'],
  ])('%s 는 성공으로 보지 않고 status·code 를 가진 ApiError 로 던진다', async (status, code) => {
    stubServer({ remove: () => jsonResponse(status, { code, message: '서버 원문' }) });

    await expect(remove('351')).rejects.toMatchObject({ kind: 'http', status, code });
  });

  it('서버에 닿지 못하면 network 오류로 던진다', async () => {
    stubServer({
      remove: () => {
        throw new TypeError('Failed to fetch');
      },
    });

    await expect(remove('351')).rejects.toMatchObject({ kind: 'network' });
  });

  it('id 가 숫자가 아니면 요청 없이 INVALID_ID 오류다', async () => {
    const { calls } = stubServer();

    await expect(remove('mock-request-1')).rejects.toMatchObject({ code: 'INVALID_ID' });

    expect(deletesIn(calls)).toHaveLength(0);
  });
});

describe('mapMyRequests 의 빈 값 처리', () => {
  const base = {
    id: 1,
    dong: { id: 1, name: '포곡읍' },
    category: { id: 33, name: '태권도장' },
    count: 1,
  };

  it('goal·시각·시간대·빈도가 없거나 알 수 없어도 깨지지 않는다', () => {
    const [item] = mapMyRequests(
      [{ ...base, timeSlots: ['NIGHT'], frequency: 'DAILY', createdAt: 'not-a-date' }],
      [],
    );

    expect(item?.request.visitTimes).toEqual([]);
    expect(item?.request).not.toHaveProperty('visitFrequency');
    expect(item).not.toHaveProperty('createdAt');
    expect(item?.category).toMatchObject({ id: '33', name: '태권도장', cardTitle: '태권도장' });
  });

  it('count 가 없거나 음수면 0 이고, id 가 올바르지 않으면 INVALID_ID 오류다', () => {
    expect(mapMyRequests([{ ...base, count: undefined }], [])[0]?.requestCount).toBe(0);
    expect(mapMyRequests([{ ...base, count: -3 }], [])[0]?.requestCount).toBe(0);
    expect(() => mapMyRequests([{ ...base, id: 0 }], [])).toThrow(
      expect.objectContaining({ code: 'INVALID_ID' }),
    );
    expect(() => mapMyRequests({} as never, [])).toThrow(
      expect.objectContaining({ kind: 'parse' }),
    );
  });
});
