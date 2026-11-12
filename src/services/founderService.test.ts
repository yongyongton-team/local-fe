import { describe, expect, it } from 'vitest';
import { mockNeighborhoodCenters } from '@/mocks/demand';
import { demandService, founderService, merchantService, requestSubmitter } from '.';

const FRUIT = 'fruit-vegetable';
const summary = async (categoryId: string) =>
  (await founderService.listLocationRanks(categoryId)).map((r) => [
    r.rank,
    r.neighborhood.name,
    r.requestCount,
    r.nearbySameCategoryCount,
    r.nearestHypermarketKm,
  ]);

describe('입지 순위 목 서비스', () => {
  it('과일/채소: 목 서버가 정한 순서 그대로이고(요청 0명 예시동이 2위), 실제 동네는 수요 데이터 값을 그대로 쓴다', async () => {
    const rows = await summary(FRUIT);

    expect(rows.map((r) => [r[0], r[1], r[2]])).toEqual([
      [1, '구성동', 29],
      [2, '예시동 가', 0],
      [3, '보정동', 14],
      [4, '마북동', 9],
      [5, '예시동 나', 2],
      [6, '예시동 다', 1],
      [7, '예시동 라', 3],
    ]);
    expect(rows[0]).toEqual([1, '구성동', 29, 0, 2.4]);
    expect(rows[2]).toEqual([3, '보정동', 14, 1, 1.9]);
    expect(rows[3]).toEqual([4, '마북동', 9, 0, 3.1]);
  });

  it('요청 수로 다시 정렬하지 않는다: 요청이 더 많은 동네가 아래에 있어도 서버 순서 그대로다', async () => {
    const rows = await founderService.listLocationRanks(FRUIT);

    const counts = rows.map((r) => r.requestCount);
    expect(counts).not.toEqual([...counts].sort((a, b) => b - a));
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('공공데이터: 판정 5가지, 소수 expectedCount, 숫자 없는 NOT_JUDGED, 공공데이터 없는 항목이 모두 있다', async () => {
    const rows = await founderService.listLocationRanks(FRUIT);

    expect(new Set(rows.map((r) => r.publicData?.verdict).filter(Boolean))).toEqual(
      new Set(['SHORT', 'SOME_NEARBY', 'NEXT_DONG', 'NOT_SHORT', 'NOT_JUDGED']),
    );
    expect(rows.some((r) => !Number.isInteger(r.publicData?.expectedCount ?? 0))).toBe(true);
    expect(rows.find((r) => r.neighborhood.name === '마북동')).not.toHaveProperty('publicData');
    const notJudged = rows.find((r) => r.publicData?.verdict === 'NOT_JUDGED')!;
    expect([notJudged.publicData?.expectedCount, notJudged.publicData?.dongStoreCount]).toEqual([
      0, 0,
    ]);
    // 목 안의 임의 문구다(실서버 문구가 아니다).
    expect(
      rows.every(
        (r) => !r.publicData?.verdictLabel || r.publicData.verdictLabel.startsWith('[임의]'),
      ),
    ).toBe(true);
  });

  it('공공데이터를 바꿔도 목 원본은 바뀌지 않는다(복사본)', async () => {
    const [first] = await founderService.listLocationRanks(FRUIT);
    if (first?.publicData) first.publicData.verdictLabel = '바뀜';

    expect((await founderService.listLocationRanks(FRUIT))[0]?.publicData?.verdictLabel).not.toBe(
      '바뀜',
    );
  });

  it('업종별로 필터한다: 수요 데이터가 있는 동네만 나오고 순위는 1부터 이어진다', async () => {
    expect(await summary('side-dish')).toEqual([[1, '구성동', 12, 0, undefined]]);
    expect(await summary('bakery')).toEqual([[1, '구성동', 6, 0, undefined]]);
  });

  it('대형마트 거리가 없는 항목에는 그 값이 없다', async () => {
    const [first] = await founderService.listLocationRanks('side-dish');

    expect(first).toBeDefined();
    expect('nearestHypermarketKm' in first!).toBe(false);
  });

  it('데이터가 없는 업종이면 빈 배열이다', async () => {
    expect(await founderService.listLocationRanks('unknown')).toEqual([]);
  });

  it('동네 위치는 업종이 바뀌어도 같다', async () => {
    const fruit = (await founderService.listLocationRanks(FRUIT)).find(
      (r) => r.neighborhood.id === 'guseong',
    );
    const side = (await founderService.listLocationRanks('side-dish')).find(
      (r) => r.neighborhood.id === 'guseong',
    );

    expect(side?.position).toEqual(fruit?.position);
  });

  it('주민이 과일/채소 요청을 보내면 구성동 인원이 29에서 30으로 반영된다', async () => {
    await requestSubmitter.submit({
      neighborhoodId: 'guseong',
      categoryId: FRUIT,
      detail: '과일가게요',
      conditions: [],
      visitTimes: [],
    });

    expect((await summary(FRUIT))[0]).toEqual([1, '구성동', 30, 0, 2.4]);
  });

  it('주민 요청으로 수요가 생긴 동네는 같은 서비스의 순위에 들어온다', async () => {
    await requestSubmitter.submit({
      neighborhoodId: 'bojeong',
      categoryId: 'side-dish',
      detail: '반찬가게요',
      conditions: [],
      visitTimes: [],
    });

    // 목 서버의 순서(구성동 → 보정동)대로 보정동이 2위로 들어온다. 요청 수로 다시 정렬하지 않는다.
    const ranks = await founderService.listLocationRanks('side-dish');
    expect(ranks.map((r) => [r.rank, r.neighborhood.name, r.requestCount])).toEqual([
      [1, '구성동', 12],
      [2, '보정동', 1],
    ]);
  });

  it('원문 문장이나 개인 정보를 돌려주지 않는다', async () => {
    await requestSubmitter.submit({
      neighborhoodId: 'guseong',
      categoryId: FRUIT,
      detail: '비밀 문장 홍길동',
      conditions: [],
      visitTimes: [],
    });

    expect(JSON.stringify(await founderService.listLocationRanks(FRUIT))).not.toContain('비밀');
  });

  it('업종 목록은 기존 업종 데이터 전부다', async () => {
    expect((await demandService.listCategories()).map((c) => c.cardTitle)).toEqual([
      '과일 / 채소 가게',
      '반찬가게',
      '빵집',
    ]);
  });
});

describe('동네 리포트 목 서비스', () => {
  const report = (areaId: string, categoryId = FRUIT) =>
    founderService.getAreaReport({ areaId, categoryId });

  it('구성동: 인원·같은 업종·대형마트 거리는 수요 데이터, 시간대는 분포의 최상위다', async () => {
    const r = await report('guseong');

    expect(r?.neighborhood.name).toBe('구성동');
    expect(r?.category.titleLabel).toBe('과일 가게');
    expect(r?.demand).toMatchObject({
      requestCount: 29,
      nearbySameCategoryCount: 0,
      nearestHypermarketKm: 2.4,
    });
    expect(r?.peakVisitTime).toBe('weekday-evening');
  });

  it('보정동·마북동의 수치와 시간대', async () => {
    const bojeong = await report('bojeong');
    const mabuk = await report('mabuk');

    expect([bojeong?.demand.requestCount, bojeong?.demand.nearbySameCategoryCount]).toEqual([
      14, 1,
    ]);
    expect(bojeong?.demand.nearestHypermarketKm).toBe(1.9);
    expect(bojeong?.peakVisitTime).toBe('weekend');
    expect([mabuk?.demand.requestCount, mabuk?.demand.nearbySameCategoryCount]).toEqual([9, 0]);
    expect(mabuk?.demand.nearestHypermarketKm).toBe(3.1);
    expect(mabuk?.peakVisitTime).toBe('weekday-day');
  });

  it('사장님 동네 상세의 최상위 시간대와 모든 동네에서 같다(분포 한 곳)', async () => {
    for (const areaId of ['guseong', 'bojeong', 'mabuk']) {
      const detail = await merchantService.getAreaDetail({ areaId, categoryId: FRUIT });
      expect((await report(areaId))?.peakVisitTime).toBe(detail?.visitTimes[0]?.time);
    }
  });

  it('업종별로 다른 수요를 돌려주고 대형마트 값이 없으면 그 속성이 없다', async () => {
    const side = await report('guseong', 'side-dish');

    expect(side?.demand.requestCount).toBe(12);
    expect(side?.category.cardTitle).toBe('반찬가게');
    expect(side?.demand.nearestHypermarketKm).toBeUndefined();
  });

  it('주민이 과일/채소 요청을 보내면 구성동 인원이 29에서 30으로 반영된다', async () => {
    await requestSubmitter.submit({
      neighborhoodId: 'guseong',
      categoryId: FRUIT,
      detail: '과일가게요',
      conditions: [],
      visitTimes: [],
    });

    expect((await report('guseong'))?.demand.requestCount).toBe(30);
  });

  it('돌려준 수치를 바꿔도 메모리 DB 는 바뀌지 않는다', async () => {
    const r = await report('guseong');
    r!.demand.requestCount = 999;

    expect((await report('guseong'))?.demand.requestCount).toBe(29);
  });

  it('없는 동네이거나 수요 데이터가 없는 업종이면 null 이다', async () => {
    await expect(report('unknown')).resolves.toBeNull();
    await expect(report('guseong', 'unknown')).resolves.toBeNull();
    await expect(report('mabuk', 'bakery')).resolves.toBeNull();
  });

  it('원문 문장이나 개인 정보를 돌려주지 않는다', async () => {
    await requestSubmitter.submit({
      neighborhoodId: 'guseong',
      categoryId: FRUIT,
      detail: '비밀 문장 홍길동',
      conditions: [],
      visitTimes: [],
    });

    expect(JSON.stringify(await report('guseong'))).not.toContain('비밀');
  });
});

describe('입지 순위의 지도 좌표(서비스 계층)', () => {
  it('순위 항목마다 동네 중심 좌표(임시)가 위도·경도로 내려온다', async () => {
    const ranks = await founderService.listLocationRanks(FRUIT);

    // 예시동(목 동네에 없는 행)은 위치 정보가 없어 좌표도 없다. 실제 동네 3곳만 좌표가 있다.
    const real = ranks.filter((r) => r.neighborhood.district !== '');
    expect(real).toHaveLength(3);
    expect(
      ranks.filter((r) => r.neighborhood.district === '').every((r) => r.lat === undefined),
    ).toBe(true);
    for (const rank of real) {
      const center = mockNeighborhoodCenters.find((c) => c.neighborhoodId === rank.neighborhood.id);
      expect(rank.lat).toBe(center?.lat);
      expect(rank.lng).toBe(center?.lng);
      // 용인시 기흥구 부근(위도 37.x, 경도 127.x): 뒤바뀌거나 NaN 이 아니다.
      expect(rank.lat).toBeGreaterThan(37.2);
      expect(rank.lat).toBeLessThan(37.4);
      expect(rank.lng).toBeGreaterThan(127.0);
      expect(rank.lng).toBeLessThan(127.2);
    }
  });

  it('좌표는 동네에 속한 값이라 업종이 바뀌어도 같고, 동네마다 다르다', async () => {
    const fruit = await founderService.listLocationRanks(FRUIT);
    const side = await founderService.listLocationRanks('side-dish');
    const guseong = (ranks: typeof fruit) => ranks.find((r) => r.neighborhood.id === 'guseong');

    expect([side[0]?.lat, side[0]?.lng]).toEqual([guseong(fruit)?.lat, guseong(fruit)?.lng]);
    expect(
      new Set(fruit.filter((r) => r.lat !== undefined).map((r) => `${r.lat}|${r.lng}`)).size,
    ).toBe(3);
  });

  it('자리표시자용 상대좌표(position)도 그대로 유지한다', async () => {
    const [first] = await founderService.listLocationRanks(FRUIT);

    expect(first?.position?.x).toBeGreaterThan(0);
    expect(first?.position?.x).toBeLessThan(1);
  });
});
