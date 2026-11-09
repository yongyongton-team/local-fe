import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StoreCategory } from '@/types/domain';
import { jsonResponse, stubFetch, type StubCall } from '@/test/apiStub';
import { createApiClient } from './apiClient';
import { createApiFounderService, RANKING_LIMIT } from './apiFounderService';
import { tryToServerId } from './ids';
import { HIDE_ZERO_REQUEST_RANKS, mapFounderReport, mapRankings } from './mappers';
import { createTokenStore } from './tokenStore';

const GUEST = '/api/v1/auth/guest';
const category = (id: string, name: string): StoreCategory => ({
  id,
  name,
  cardTitle: `${name} 카드`,
  requestLabel: name,
  missingLabel: name,
  objectPhrase: name,
  titleLabel: `${name} 타이틀`,
  martCheck: false,
});
const CATEGORIES = [category('7', '과일·채소 가게'), category('18', '반찬가게')];

function newServices() {
  const client = createApiClient({
    baseUrl: 'https://api.test',
    store: createTokenStore(),
    now: () => 1_000_000,
  });
  return createApiFounderService({
    listCategories: async () => CATEGORIES,
    getClient: () => client,
  });
}

type Handler = (call: StubCall, init: RequestInit) => Response | Promise<Response>;
function stubServer(routes: { rankings?: Handler; report?: Handler } = {}) {
  return stubFetch((call, init) => {
    if (call.path === GUEST) return jsonResponse(200, { accessToken: 'tok-1', expiresIn: 3600 });
    if (call.path.startsWith('/api/v1/founder/rankings')) {
      return routes.rankings?.(call, init) ?? jsonResponse(200, { items: [] });
    }
    if (call.path.startsWith('/api/v1/founder/report')) {
      return (
        routes.report?.(call, init) ??
        jsonResponse(200, { stats: { requestCount: 0, walkStoreCount: 0 } })
      );
    }
    return jsonResponse(404, { code: 'NOT_FOUND' });
  });
}

const ITEMS = [
  {
    rank: 1,
    dongId: 22,
    name: '구성동',
    requestCount: 29,
    sameCategoryStoreCount: 0,
    nearestMartKm: 2.4,
    score: 29,
  },
  {
    rank: 2,
    dongId: 28,
    name: '보정동',
    requestCount: 14,
    sameCategoryStoreCount: 2,
    nearestMartKm: 0.6,
    score: 4,
  },
  { rank: 3, dongId: 16, name: '영덕2동', requestCount: 0, sameCategoryStoreCount: 0, score: 0 },
];

beforeEach(() => localStorage.clear());

describe('mapRankings', () => {
  it('숫자 id 를 문자열로 바꾸고 서버 순서·순위를 그대로 둔다(요청 수로 다시 정렬하지 않는다)', () => {
    const shuffled = [ITEMS[2]!, ITEMS[0]!, ITEMS[1]!].map((item, i) => ({ ...item, rank: i + 1 }));

    const ranks = mapRankings({ items: shuffled });

    expect(ranks.map((r) => [r.rank, r.neighborhood.id, r.neighborhood.name])).toEqual([
      [1, '16', '영덕2동'],
      [2, '22', '구성동'],
      [3, '28', '보정동'],
    ]);
    expect(ranks[1]).toMatchObject({
      requestCount: 29,
      nearbySameCategoryCount: 0,
      nearestHypermarketKm: 2.4,
      neighborhood: { district: '' },
    });
  });

  it('nearestMartKm 가 없으면 거리를 비우고, 서버에 없는 좌표·위치를 만들어 넣지 않는다', () => {
    const [first, , third] = mapRankings({ items: ITEMS });

    expect(third).not.toHaveProperty('nearestHypermarketKm');
    for (const rank of [first, third]) {
      expect(rank).not.toHaveProperty('lat');
      expect(rank).not.toHaveProperty('lng');
      expect(rank).not.toHaveProperty('position');
    }
  });

  it('빈 items 는 빈 배열이다', () => {
    expect(mapRankings({ items: [] })).toEqual([]);
  });

  it('서버가 준 순위 값(동점 등으로 연속이 아닐 수 있다)을 그대로 쓴다', () => {
    const ranks = mapRankings({
      items: [
        { ...ITEMS[0]!, rank: 1 },
        { ...ITEMS[1]!, rank: 1 },
        { ...ITEMS[2]!, rank: 3 },
      ],
    });

    expect(ranks.map((r) => r.rank)).toEqual([1, 1, 3]);
  });

  it('rank 가 없으면 서버 순서의 번호를 쓴다', () => {
    const ranks = mapRankings({ items: ITEMS.map(({ rank, ...rest }) => (void rank, rest)) });

    expect(ranks.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  it('요청 0명 동네는 기본 규칙(HIDE_ZERO_REQUEST_RANKS)대로 그대로 두고, 규칙을 켜면 뺀다', () => {
    expect(HIDE_ZERO_REQUEST_RANKS).toBe(false);
    expect(mapRankings({ items: ITEMS })).toHaveLength(3);

    const hidden = mapRankings({ items: ITEMS }, true);

    expect(hidden.map((r) => r.neighborhood.id)).toEqual(['22', '28']);
    expect(hidden.map((r) => r.rank)).toEqual([1, 2]);
  });

  it('id 가 올바르지 않으면 INVALID_ID, 이름·개수가 없거나 items 가 없으면 parse 오류다', () => {
    expect(() => mapRankings({ items: [{ ...ITEMS[0]!, dongId: 0 }] })).toThrow(
      expect.objectContaining({ code: 'INVALID_ID' }),
    );
    expect(() => mapRankings({ items: [{ ...ITEMS[0]!, name: '' }] })).toThrow(
      expect.objectContaining({ kind: 'parse' }),
    );
    expect(() =>
      mapRankings({ items: [{ ...ITEMS[0]!, sameCategoryStoreCount: undefined }] }),
    ).toThrow(expect.objectContaining({ kind: 'parse' }));
    expect(() => mapRankings({})).toThrow(expect.objectContaining({ kind: 'parse' }));
    expect(() => mapRankings(undefined)).toThrow(expect.objectContaining({ kind: 'parse' }));
  });
});

describe('mapFounderReport', () => {
  const context = { neighborhoodId: '22', categoryId: '7', categories: CATEGORIES };
  const FULL = {
    dong: { id: 22, name: '구성동', gu: '기흥구' },
    category: { id: 7, name: '과일·채소 가게' },
    stats: {
      requestCount: 29,
      walkStoreCount: 0,
      walkRadiusM: 1000,
      nearestMart: { name: '이마트 동백점', km: 2.4 },
      topTimeSlot: 'WEEKDAY_EVENING',
      topConditions: ['늦게까지 영업'],
      offers: { done: 0, orders: 0 },
    },
    explanation: { text: '구성동은 …', by: 'AI' },
    sources: [{ name: '상가 정보' }, { name: '대규모 점포 현황', asOf: '2026-05-07' }],
  };

  it('수치·시간대·설명·근거를 도메인으로 바꾼다(시간대 코드 → VisitTime)', () => {
    const report = mapFounderReport(FULL, context);

    expect(report).toEqual({
      neighborhood: { id: '22', district: '기흥구', name: '구성동' },
      category: CATEGORIES[0],
      demand: {
        neighborhoodId: '22',
        categoryId: '7',
        requestCount: 29,
        nearbySameCategoryCount: 0,
        nearestHypermarketKm: 2.4,
      },
      peakVisitTime: 'weekday-evening',
      explanation: { text: '구성동은 …', by: 'AI' },
      sources: [{ name: '상가 정보' }, { name: '대규모 점포 현황', asOf: '2026-05-07' }],
    });
  });

  it.each([
    ['null(요청 없음)', null],
    ['알 수 없는 코드', 'NIGHT'],
    ['없음', undefined],
  ])('topTimeSlot 이 %s 이면 peakVisitTime 을 비운다', (_name, topTimeSlot) => {
    const report = mapFounderReport({ ...FULL, stats: { ...FULL.stats, topTimeSlot } }, context);

    expect(report).not.toHaveProperty('peakVisitTime');
  });

  it('nearestMart·설명·근거가 null 이거나 없어도 깨지지 않고, 서버에 없는 값은 만들지 않는다', () => {
    const report = mapFounderReport(
      {
        stats: { requestCount: 0, walkStoreCount: 9, nearestMart: null, topTimeSlot: null },
        explanation: null,
        sources: null,
      },
      context,
    );

    expect(report.demand).not.toHaveProperty('nearestHypermarketKm');
    expect(report).not.toHaveProperty('explanation');
    expect(report).not.toHaveProperty('sources');
    // dong 이 없으면 요청한 동네 id 를 쓰고, 구·이름은 비운다. 업종은 목록에서 찾는다.
    expect(report.neighborhood).toEqual({ id: '22', district: '', name: '' });
    expect(report.category).toEqual(CATEGORIES[0]);
  });

  it('업종 목록에 없으면 응답의 이름으로 업종을 만들고, stats 나 개수가 없으면 parse 오류다', () => {
    const report = mapFounderReport(
      { ...FULL, category: { id: 99, name: '꽃집' } },
      { ...context, categoryId: '99' },
    );
    expect(report.category).toMatchObject({ id: '99', name: '꽃집', cardTitle: '꽃집' });

    expect(() => mapFounderReport({}, context)).toThrow(expect.objectContaining({ kind: 'parse' }));
    expect(() =>
      mapFounderReport({ stats: { requestCount: 1, walkStoreCount: null } }, context),
    ).toThrow(expect.objectContaining({ kind: 'parse' }));
  });
});

describe('tryToServerId', () => {
  it('숫자 문자열만 숫자로 바꾸고, 그 밖의 값은 던지지 않고 null 이다', () => {
    expect(tryToServerId('22')).toBe(22);
    for (const bad of ['guseong', '0', '-1', '1.5', '', '007', null, undefined]) {
      expect(tryToServerId(bad)).toBeNull();
    }
  });
});

describe('createApiFounderService', () => {
  it('순위: categoryId 와 limit 를 숫자 쿼리로 보내고 서버 응답을 도메인으로 바꾼다', async () => {
    const { calls } = stubServer({ rankings: () => jsonResponse(200, { items: ITEMS }) });

    const ranks = await newServices().founderService.listLocationRanks('7');

    expect(ranks).toHaveLength(3);
    const call = calls.find((c) => c.path.startsWith('/api/v1/founder/rankings'));
    expect(call?.path).toBe(`/api/v1/founder/rankings?categoryId=7&limit=${RANKING_LIMIT}`);
    expect(call?.method).toBe('GET');
    expect(call?.authorization).toBe('Bearer tok-1');
  });

  it('순위: 숫자가 아닌 업종 id 는 요청 없이 INVALID_ID 오류다', async () => {
    const { fn } = stubServer();

    await expect(
      newServices().founderService.listLocationRanks('fruit-vegetable'),
    ).rejects.toMatchObject({
      code: 'INVALID_ID',
    });
    expect(fn).not.toHaveBeenCalled();
  });

  it('리포트: dongId·categoryId 를 숫자 쿼리로 보내고 도메인으로 바꾼다', async () => {
    const { calls } = stubServer({
      report: () =>
        jsonResponse(200, {
          dong: { id: 22, name: '구성동', gu: '기흥구' },
          stats: { requestCount: 29, walkStoreCount: 0, topTimeSlot: 'WEEKEND' },
          explanation: { text: '문장', by: 'TEMPLATE' },
        }),
    });

    const report = await newServices().founderService.getAreaReport({
      areaId: '22',
      categoryId: '7',
    });

    expect(report).toMatchObject({
      neighborhood: { id: '22', district: '기흥구', name: '구성동' },
      peakVisitTime: 'weekend',
      explanation: { text: '문장', by: 'TEMPLATE' },
    });
    expect(calls.find((c) => c.path.startsWith('/api/v1/founder/report'))?.path).toBe(
      '/api/v1/founder/report?dongId=22&categoryId=7',
    );
  });

  it.each([
    ['동네 id 가 slug', { areaId: 'guseong', categoryId: '7' }],
    ['업종 id 가 숫자가 아님', { areaId: '22', categoryId: 'fruit-vegetable' }],
    ['동네 id 가 0', { areaId: '0', categoryId: '7' }],
  ])('리포트: %s 이면 요청 없이 null(찾을 수 없음)이다', async (_name, query) => {
    const { fn } = stubServer();

    await expect(newServices().founderService.getAreaReport(query)).resolves.toBeNull();
    expect(fn).not.toHaveBeenCalled();
  });

  it.each([
    [403, 'FORBIDDEN'],
    [404, 'NOT_FOUND'],
    [400, 'VALIDATION_ERROR'],
  ])('%s %s 는 code 를 가진 ApiError 로 던진다', async (status, code) => {
    stubServer({
      rankings: () => jsonResponse(status, { code, message: '서버 원문' }),
      report: () => jsonResponse(status, { code, message: '서버 원문' }),
    });
    const { founderService } = newServices();

    await expect(founderService.listLocationRanks('7')).rejects.toMatchObject({ status, code });
    await expect(
      founderService.getAreaReport({ areaId: '9999', categoryId: '7' }),
    ).rejects.toMatchObject({ status, code });
  });

  it.each(['rankings', 'report'] as const)(
    '%s: 응답을 기다리는 중에 abort 하면 요청이 취소된다',
    async (which) => {
      let fetchSignal: AbortSignal | null | undefined;
      const hang: Handler = (_c, init) =>
        new Promise<Response>((_resolve, reject) => {
          fetchSignal = init.signal;
          init.signal?.addEventListener('abort', () => reject(init.signal?.reason));
        });
      const { calls } = stubServer({ rankings: hang, report: hang });
      const controller = new AbortController();
      const { founderService } = newServices();

      const pending =
        which === 'rankings'
          ? founderService.listLocationRanks('7', controller.signal)
          : founderService.getAreaReport({ areaId: '22', categoryId: '7' }, controller.signal);
      const outcome = pending.then(
        () => 'resolved',
        (error: unknown) => error,
      );
      await vi.waitFor(() => expect(calls.some((c) => c.path.includes('/founder/'))).toBe(true));
      controller.abort();

      expect(await outcome).toMatchObject({ name: 'AbortError' });
      expect(fetchSignal?.aborted).toBe(true);
    },
  );

  it('설명 생성기는 리포트 응답의 문장을 돌려주고(호출 없음), 문장이 없으면 parse 오류다', async () => {
    const { fn } = stubServer();
    const { reportDescriptionGenerator } = newServices();
    const base = {
      neighborhood: { id: '22', district: '', name: '구성동' },
      category: CATEGORIES[0]!,
      demand: {
        neighborhoodId: '22',
        categoryId: '7',
        requestCount: 1,
        nearbySameCategoryCount: 0,
      },
    };

    await expect(
      reportDescriptionGenerator.generate({ ...base, explanation: { text: '서버 문장' } }),
    ).resolves.toBe('서버 문장');
    await expect(reportDescriptionGenerator.generate(base)).rejects.toMatchObject({
      kind: 'parse',
    });
    expect(fn).not.toHaveBeenCalled();
  });
});
