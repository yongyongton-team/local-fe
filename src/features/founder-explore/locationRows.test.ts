import { describe, expect, it } from 'vitest';
import type { LocationRank, PublicData, StoreCategory } from '@/types/domain';
import {
  buildMapSummary,
  buildRankMarkers,
  describeLocationRow,
  describePublicData,
  resolveCategoryId,
} from './locationRows';

const rank = (overrides: Partial<LocationRank> = {}): LocationRank => ({
  rank: 1,
  neighborhood: { id: 'guseong', district: '기흥구', name: '구성동' },
  requestCount: 29,
  nearbySameCategoryCount: 0,
  nearestHypermarketKm: 2.4,
  position: { x: 0.37, y: 0.16 },
  ...overrides,
});

const category = (id: string, cardTitle = id): StoreCategory => ({
  id,
  name: id,
  cardTitle,
  requestLabel: id,
  missingLabel: id,
  objectPhrase: id,
  titleLabel: id,
});

describe('describeLocationRow', () => {
  it('제목과 둘째 줄을 데이터에서 만든다', () => {
    const text = describeLocationRow(rank());

    expect(text.title).toBe('1. 구성동');
    expect(text.detail).toBe('요청 29명 · 같은 업종 0곳 · 대형마트 2.4km');
    expect(text.accessibleName).toBe('1. 구성동, 요청 29명, 같은 업종 0곳, 대형마트 2.4km');
  });

  it('대형마트 거리가 없으면 그 부분을 뺀다', () => {
    const withoutKm: LocationRank = {
      rank: 1,
      neighborhood: { id: 'guseong', district: '기흥구', name: '구성동' },
      requestCount: 29,
      nearbySameCategoryCount: 0,
      position: { x: 0.37, y: 0.16 },
    };
    const text = describeLocationRow(withoutKm);

    expect(text.detail).toBe('요청 29명 · 같은 업종 0곳');
    expect(text.accessibleName).toBe('1. 구성동, 요청 29명, 같은 업종 0곳');
  });
});

const pd = (overrides: Partial<PublicData> = {}): PublicData => ({
  population: 10000,
  expectedCount: 6.7,
  dongStoreCount: 4,
  verdict: 'SHORT',
  verdictLabel: '[임의] 부족해요',
  ...overrides,
});

describe('describePublicData', () => {
  it('"기대 N곳 · 실제 M곳"과 서버 판정 문구를 " · "로 잇는다', () => {
    expect(describePublicData(pd())).toBe('기대 7곳 · 실제 4곳 · [임의] 부족해요');
  });

  it.each([
    [6.7, 7],
    [10.5, 11],
    [9, 9],
    [0.4, 0],
    [2.49, 2],
  ])('기대 %s곳은 %s곳으로 반올림하고, 실제 가게 수는 그대로다', (expected, shown) => {
    expect(describePublicData(pd({ expectedCount: expected, dongStoreCount: 12 }))).toBe(
      `기대 ${shown}곳 · 실제 12곳 · [임의] 부족해요`,
    );
  });

  it('NOT_JUDGED 는 숫자가 있어도 숫자 없이 판정 문구만 보인다', () => {
    const line = describePublicData(
      pd({ verdict: 'NOT_JUDGED', expectedCount: 0, dongStoreCount: 0 }),
    );

    expect(line).toBe('[임의] 부족해요');
    expect(
      describePublicData(pd({ verdict: 'NOT_JUDGED', expectedCount: 5, dongStoreCount: 2 })),
    ).toBe('[임의] 부족해요');
  });

  it('publicData 가 없으면 아무것도 없다', () => {
    expect(describePublicData(undefined)).toBeNull();
    expect(describePublicData({})).toBeNull();
  });

  it('숫자 둘 중 하나라도 없거나 올바르지 않으면 숫자를 숨기고 판정 문구만 보인다', () => {
    expect(describePublicData(pd({ expectedCount: undefined }))).toBe('[임의] 부족해요');
    expect(describePublicData(pd({ dongStoreCount: undefined }))).toBe('[임의] 부족해요');
    expect(describePublicData(pd({ expectedCount: Number.NaN }))).toBe('[임의] 부족해요');
    expect(describePublicData(pd({ dongStoreCount: -1 }))).toBe('[임의] 부족해요');
  });

  it('판정 문구가 없으면 숫자만, 둘 다 없으면 null 이다', () => {
    expect(describePublicData(pd({ verdictLabel: undefined }))).toBe('기대 7곳 · 실제 4곳');
    expect(describePublicData(pd({ verdictLabel: '  ' }))).toBe('기대 7곳 · 실제 4곳');
    expect(
      describePublicData(pd({ verdictLabel: undefined, expectedCount: undefined })),
    ).toBeNull();
  });

  it('부족하지 않다는 판정(NOT_SHORT)과 모르는 판정 값도 숨기지 않는다', () => {
    expect(describePublicData(pd({ verdict: 'NOT_SHORT' }))).toContain('기대 7곳');
    expect(describePublicData(pd({ verdict: 'SOMETHING_NEW' }))).toContain('기대 7곳');
  });
});

describe('describeLocationRow 의 공공데이터 줄', () => {
  it('extra 와 접근 가능한 이름에 한 문장으로 들어가고, detail 은 그대로다', () => {
    const text = describeLocationRow(rank({ publicData: pd() }));

    expect(text.detail).toBe('요청 29명 · 같은 업종 0곳 · 대형마트 2.4km');
    expect(text.extra).toBe('기대 7곳 · 실제 4곳 · [임의] 부족해요');
    expect(text.accessibleName).toBe(
      '1. 구성동, 요청 29명, 같은 업종 0곳, 대형마트 2.4km, 기대 7곳 · 실제 4곳 · [임의] 부족해요',
    );
  });

  it('공공데이터가 없으면 extra 속성 자체가 없다', () => {
    expect('extra' in describeLocationRow(rank())).toBe(false);
  });

  it('요청 0명 행도 기존 문구 그대로 "요청 0명"이다', () => {
    expect(describeLocationRow(rank({ requestCount: 0 })).detail).toBe(
      '요청 0명 · 같은 업종 0곳 · 대형마트 2.4km',
    );
  });
});

describe('buildRankMarkers', () => {
  it('라벨은 "{순위}. {동네}", 위치는 동네 데이터, 종류는 기존 요청 마커다', () => {
    const markers = buildRankMarkers([rank(), rank({ rank: 2 })], 'fruit-vegetable');

    expect(markers[0]).toMatchObject({
      kind: 'request',
      label: '1. 구성동',
      position: { x: 0.37, y: 0.16 },
    });
    expect(markers[1]?.label).toBe('2. 구성동');
    expect(new Set(markers.map((m) => m.id)).size).toBe(1);
  });
});

describe('buildRankMarkers 좌표', () => {
  it('순위 데이터의 위도·경도를 마커로 그대로 전달한다', () => {
    const [marker] = buildRankMarkers([rank({ lat: 37.2979, lng: 127.1054 })], 'fruit-vegetable');

    expect(marker).toMatchObject({ lat: 37.2979, lng: 127.1054 });
  });

  it('좌표가 없으면 lat·lng 를 만들지 않는다(자리표시자 지도만 이 마커를 그린다)', () => {
    const [marker] = buildRankMarkers([rank()], 'fruit-vegetable');

    expect('lat' in marker!).toBe(false);
    expect('lng' in marker!).toBe(false);
  });
});

describe('buildMapSummary / resolveCategoryId', () => {
  it('요약은 업종 카드 제목과 동네 수로 만든다', () => {
    expect(buildMapSummary(category('f', '과일 / 채소 가게'), 3)).toBe(
      '과일 / 채소 가게 기준 동네 3곳 표시 중',
    );
  });

  it('쿼리 값이 목록에 있으면 그 업종, 없거나 올바르지 않으면 기본 업종이다', () => {
    const list = [category('a'), category('b')];

    expect(resolveCategoryId('b', list, 'a')).toBe('b');
    expect(resolveCategoryId(null, list, 'a')).toBe('a');
    expect(resolveCategoryId('zzz', list, 'a')).toBe('a');
    expect(resolveCategoryId('', list, 'a')).toBe('a');
  });
});
