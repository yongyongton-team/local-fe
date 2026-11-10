import { describe, expect, it } from 'vitest';
import type { LocationRank, StoreCategory } from '@/types/domain';
import {
  buildMapSummary,
  buildRankMarkers,
  describeLocationRow,
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
