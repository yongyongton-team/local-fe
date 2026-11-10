import { describe, expect, it } from 'vitest';
import { mockNeighborhoodCenters } from '@/mocks/demand';
import { merchantService, requestSubmitter } from '.';
import { haversineKm } from './geo';

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

    // 거리는 가게 좌표와 동네 중심 좌표의 직선거리다(소수점 한 자리: 0.3 / 2.4 / 1.8km).
    expect(
      areas.map((a) => [a.distanceKm.toFixed(1), a.peakVisitTime, a.nearbySameCategoryCount]),
    ).toEqual([
      ['0.3', 'weekday-evening', 0],
      ['2.4', 'weekend', 1],
      ['1.8', 'weekday-day', 0],
    ]);
  });

  it('세 동네의 거리가 모두 3km 이내라 3km·5km·전체의 목록이 같다', async () => {
    const all = await summarize(null);

    expect(await summarize(3)).toEqual(all);
    expect(await summarize(5)).toEqual(all);
  });

  it('반경을 줄이면 먼 동네가 빠진다(2.5km → 셋, 2km → 구성동·마북동, 1km → 구성동만, 0.2km → 없음)', async () => {
    // 계산 거리: 구성동 0.28km, 마북동 1.82km, 보정동 2.41km
    expect(await summarize(2.5)).toEqual([
      ['구성동', 29],
      ['보정동', 14],
      ['마북동', 9],
    ]);
    expect(await summarize(2)).toEqual([
      ['구성동', 29],
      ['마북동', 9],
    ]);
    expect(await summarize(1)).toEqual([['구성동', 29]]);
    expect(await summarize(0.2)).toEqual([]);
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

describe('사장님 지도 좌표(서비스 계층)', () => {
  it('중심 핀(가게 위치)과 마커에 위도·경도가 내려온다', async () => {
    const { markers, origin } = await merchantService.getMapData();

    expect(origin).toMatchObject({ label: '내 가게 위치', lat: 37.2985, lng: 127.1085 });
    expect(origin.position.x).toBeGreaterThan(0);
    expect(markers).toHaveLength(3);
    for (const marker of markers) {
      expect(marker.lat).toBeGreaterThan(37.2);
      expect(marker.lat).toBeLessThan(37.4);
      expect(marker.lng).toBeGreaterThan(127.0);
      expect(marker.lng).toBeLessThan(127.2);
    }
  });

  it('가게 임시 좌표는 구성동 중심에서 0.5km 안이다(기흥구 안인지는 코드로 검증할 수 없다)', async () => {
    const { origin } = await merchantService.getMapData();
    const guseong = mockNeighborhoodCenters.find((c) => c.neighborhoodId === 'guseong')!;

    expect(haversineKm({ lat: origin.lat!, lng: origin.lng! }, guseong)).toBeLessThan(0.5);
  });
});

describe('동네 거리는 좌표에서 계산한다(목록 문구·필터·지도 원의 같은 기준)', () => {
  const list = (radiusKm: number | null) =>
    merchantService.listAreaDemands({ categoryId: FRUIT, radiusKm });
  const expectedKm = async () => {
    const { origin } = await merchantService.getMapData();
    const shop = { lat: origin.lat!, lng: origin.lng! };
    return Object.fromEntries(
      mockNeighborhoodCenters.map((c) => [c.neighborhoodId, haversineKm(shop, c)]),
    );
  };

  it('각 동네의 distanceKm 은 가게 좌표와 동네 중심 좌표의 haversineKm 이다(반올림하지 않은 값)', async () => {
    const km = await expectedKm();
    const areas = await list(null);

    for (const area of areas) {
      expect(area.distanceKm).toBe(km[area.neighborhood.id]);
    }
    expect(areas.map((a) => a.distanceKm.toFixed(1))).toEqual(['0.3', '2.4', '1.8']);
  });

  it('칩 필터는 계산 거리 이하(≤)만 남긴다: 계산 거리와 같은 반경은 포함, 조금 작으면 제외', async () => {
    const km = await expectedKm();

    // 보정동 중심 거리와 정확히 같은 반경 → 포함
    expect((await list(km.bojeong!)).map((a) => a.neighborhood.name)).toContain('보정동');
    // 그보다 아주 조금 작은 반경 → 제외
    expect((await list(km.bojeong! - 1e-9)).map((a) => a.neighborhood.name)).not.toContain(
      '보정동',
    );
    // 마북동도 같다
    expect((await list(km.mabuk!)).map((a) => a.neighborhood.name)).toContain('마북동');
    expect((await list(km.mabuk! - 1e-9)).map((a) => a.neighborhood.name)).not.toContain('마북동');
  });

  it('목록에 나온 동네는 모두 지도 원(가게 좌표, 반경 km) 안에 중심이 있다', async () => {
    const km = await expectedKm();
    for (const radiusKm of [3, 5]) {
      for (const area of await list(radiusKm)) {
        expect(km[area.neighborhood.id]).toBeLessThanOrEqual(radiusKm);
      }
    }
  });

  it('3km·5km 칩에서 세 동네가 모두 보인다(세 동네 중심이 가게에서 2.5km 안에 있다)', async () => {
    const names = (areas: Awaited<ReturnType<typeof list>>) =>
      areas.map((a) => a.neighborhood.name);

    expect(names(await list(3))).toEqual(['구성동', '보정동', '마북동']);
    expect(names(await list(5))).toEqual(['구성동', '보정동', '마북동']);
    expect(names(await list(null))).toEqual(['구성동', '보정동', '마북동']);
  });

  it('요청 인원과 시간대는 거리와 무관하게 그대로다', async () => {
    const areas = await list(null);

    expect(areas.map((a) => [a.requestCount, a.peakVisitTime])).toEqual([
      [29, 'weekday-evening'],
      [14, 'weekend'],
      [9, 'weekday-day'],
    ]);
  });
});

describe('"기흥구 전체"에 보여줄 범위(서비스 계층)', () => {
  const inside = (
    p: { lat: number; lng: number },
    b: { sw: { lat: number; lng: number }; ne: { lat: number; lng: number } },
  ) => p.lat >= b.sw.lat && p.lat <= b.ne.lat && p.lng >= b.sw.lng && p.lng <= b.ne.lng;

  it('지도 기준점에 가게가 있는 구(기흥구)를 대략 감싸는 사각형이 내려온다', async () => {
    const { origin } = await merchantService.getMapData();

    expect(origin.areaBounds).toEqual({
      sw: { lat: 37.21, lng: 127.055 },
      ne: { lat: 37.335, lng: 127.17 },
    });
    expect(origin.areaBounds!.sw.lat).toBeLessThan(origin.areaBounds!.ne.lat);
    expect(origin.areaBounds!.sw.lng).toBeLessThan(origin.areaBounds!.ne.lng);
  });

  it('가게 핀, 지도 마커, 세 동네 중심이 모두 그 범위 안에 있다', async () => {
    const { origin, markers } = await merchantService.getMapData();
    const bounds = origin.areaBounds!;

    expect(inside({ lat: origin.lat!, lng: origin.lng! }, bounds)).toBe(true);
    for (const m of markers) expect(inside({ lat: m.lat!, lng: m.lng! }, bounds)).toBe(true);
    for (const c of mockNeighborhoodCenters) expect(inside(c, bounds)).toBe(true);
  });
});
