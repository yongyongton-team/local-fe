import { describe, expect, it } from 'vitest';
import { merchantService, requestSubmitter } from '.';

const FRUIT = 'fruit-vegetable';
const summarize = async (radiusKm: number | null) =>
  (await merchantService.listAreaDemands({ categoryId: FRUIT, radiusKm })).map((a) => [
    a.neighborhood.name,
    a.requestCount,
  ]);

describe('사장님 목 서비스', () => {
  it('프로필: 싱싱과일, 과일·채소, 기흥구', async () => {
    await expect(merchantService.getProfile()).resolves.toEqual({
      shopName: '싱싱과일',
      categoryId: FRUIT,
      categoryName: '과일·채소',
      district: '기흥구',
    });
  });

  it('내 업종을 원하는 동네를 요청 많은 순(구성동 → 보정동 → 마북동)으로 돌려준다', async () => {
    expect(await summarize(null)).toEqual([
      ['구성동', 29],
      ['보정동', 14],
      ['마북동', 9],
    ]);
  });

  it('각 동네의 거리, 가장 많은 시간대, 근처 같은 업종 수를 담는다', async () => {
    const areas = await merchantService.listAreaDemands({ categoryId: FRUIT, radiusKm: null });

    expect(areas.map((a) => [a.distanceKm, a.peakVisitTime, a.nearbySameCategoryCount])).toEqual([
      [1.8, 'weekday-evening', 0],
      [2.6, 'weekend', 1],
      [2.9, 'weekday-day', 0],
    ]);
  });

  it('세 동네의 거리가 모두 3km 이내라 3km·5km·전체의 목록이 같다', async () => {
    const all = await summarize(null);

    expect(await summarize(3)).toEqual(all);
    expect(await summarize(5)).toEqual(all);
  });

  it('반경을 줄이면 먼 동네가 빠진다(2km → 구성동만, 1km → 없음)', async () => {
    expect(await summarize(2)).toEqual([['구성동', 29]]);
    expect(await summarize(2.6)).toEqual([
      ['구성동', 29],
      ['보정동', 14],
    ]);
    expect(await summarize(1)).toEqual([]);
  });

  it('내 업종이 아닌 업종으로 조회하면 그 업종의 인원을 돌려준다', async () => {
    const areas = await merchantService.listAreaDemands({
      categoryId: 'side-dish',
      radiusKm: null,
    });

    expect(areas.map((a) => [a.neighborhood.name, a.requestCount])).toEqual([['구성동', 12]]);
  });

  it('주민이 과일/채소 요청을 보내면 구성동 인원이 29 → 30 으로 이 화면의 값에 반영된다', async () => {
    await requestSubmitter.submit({
      neighborhoodId: 'guseong',
      categoryId: FRUIT,
      detail: '과일가게요',
      conditions: [],
      visitTimes: [],
    });

    expect(await summarize(null)).toEqual([
      ['구성동', 30],
      ['보정동', 14],
      ['마북동', 9],
    ]);
    const { markers } = await merchantService.getMapData();
    expect(markers.find((m) => m.categoryId === FRUIT)?.label).toBe('과일 요청 30');
  });

  it('지도 데이터: 요청 마커 3개와 기준점(내 가게 위치)을 돌려준다', async () => {
    const { markers, origin } = await merchantService.getMapData();

    expect(markers.map((m) => [m.kind, m.label])).toEqual([
      ['request', '과일 요청 29'],
      ['request', '반찬 요청 12'],
      ['request', '빵 요청 6'],
    ]);
    expect(origin.label).toBe('내 가게 위치');
    // 핀(17×21)의 좌상단이 (192,133)이라 지도(402×288)의 정중앙에 놓인다.
    expect(origin.position.x).toBeCloseTo(192 / 402);
    expect(origin.position.y).toBeCloseTo(133 / 288);
  });

  it('지도 마커 위치는 지도 영역 대비 0~1 상대좌표다', async () => {
    const { markers } = await merchantService.getMapData();

    markers.forEach((m) => {
      expect(m.position.x).toBeGreaterThanOrEqual(0);
      expect(m.position.x).toBeLessThanOrEqual(1);
      expect(m.position.y).toBeGreaterThanOrEqual(0);
      expect(m.position.y).toBeLessThanOrEqual(1);
    });
  });
});

describe('사장님 동네 상세 목 서비스', () => {
  const detailOf = (areaId: string, categoryId = FRUIT) =>
    merchantService.getAreaDetail({ areaId, categoryId });

  it('구성동: 인원·근처 업종 수는 수요 데이터, 조건·시간대는 정적 목이다', async () => {
    const detail = await detailOf('guseong');

    expect(detail?.neighborhood.name).toBe('구성동');
    expect(detail?.category.titleLabel).toBe('과일 가게');
    expect([detail?.requestCount, detail?.nearbySameCategoryCount]).toEqual([29, 0]);
    expect(detail?.conditions.map((c) => [c.label, c.count])).toEqual([
      ['늦게까지 영업', 17],
      ['낱개 구매', 11],
      ['배달', 7],
    ]);
    expect(detail?.visitTimes).toEqual([
      { time: 'weekday-evening', ratio: 60 },
      { time: 'weekend', ratio: 30 },
      { time: 'weekday-day', ratio: 10 },
    ]);
  });

  it('보정동·마북동의 조건과 시간대 분포를 비율 내림차순으로 돌려준다', async () => {
    const bojeong = await detailOf('bojeong');
    const mabuk = await detailOf('mabuk');

    expect(bojeong?.conditions.map((c) => c.count)).toEqual([8, 5, 3]);
    expect(bojeong?.visitTimes.map((v) => [v.time, v.ratio])).toEqual([
      ['weekend', 60],
      ['weekday-evening', 30],
      ['weekday-day', 10],
    ]);
    expect([bojeong?.requestCount, bojeong?.nearbySameCategoryCount]).toEqual([14, 1]);
    expect(mabuk?.conditions.map((c) => c.count)).toEqual([5, 3, 2]);
    expect(mabuk?.visitTimes.map((v) => [v.time, v.ratio])).toEqual([
      ['weekday-day', 60],
      ['weekday-evening', 30],
      ['weekend', 10],
    ]);
  });

  it('탐색 목록의 "가장 많은 시간대"는 상세 분포의 첫 항목과 항상 같다', async () => {
    const areas = await merchantService.listAreaDemands({ categoryId: FRUIT, radiusKm: null });

    for (const area of areas) {
      const detail = await detailOf(area.neighborhood.id);
      expect(area.peakVisitTime).toBe(detail?.visitTimes[0]?.time);
    }
  });

  it('주민이 요청을 보내면 요청 인원만 늘고 조건·시간대는 그대로다(정적 목)', async () => {
    await requestSubmitter.submit({
      neighborhoodId: 'guseong',
      categoryId: FRUIT,
      detail: '과일가게요',
      conditions: ['배달'],
      visitTimes: ['weekend'],
    });
    const detail = await detailOf('guseong');

    expect(detail?.requestCount).toBe(30);
    expect(detail?.conditions.map((c) => c.count)).toEqual([17, 11, 7]);
    expect(detail?.visitTimes.map((v) => v.ratio)).toEqual([60, 30, 10]);
  });

  it('없는 동네이거나 수요 데이터가 없는 업종이면 null 이다', async () => {
    await expect(detailOf('unknown')).resolves.toBeNull();
    await expect(detailOf('guseong', 'unknown')).resolves.toBeNull();
    await expect(detailOf('mabuk', 'bakery')).resolves.toBeNull();
  });

  it('원문 문장이나 개인 정보를 돌려주지 않는다', async () => {
    await requestSubmitter.submit({
      neighborhoodId: 'guseong',
      categoryId: FRUIT,
      detail: '비밀 문장 홍길동',
      conditions: [],
      visitTimes: [],
    });

    expect(JSON.stringify(await detailOf('guseong'))).not.toContain('비밀 문장');
  });
});
