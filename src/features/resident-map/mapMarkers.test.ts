import { describe, expect, it } from 'vitest';
import type { MapMarker } from '@/types/domain';
import { getMarkerSummary, getVisibleMarkers } from './mapMarkers';

const MARKERS: MapMarker[] = [
  {
    id: 'r1',
    kind: 'request',
    categoryId: 'a',
    label: '과일 요청 29',
    position: { x: 0.1, y: 0.2 },
  },
  { id: 'r2', kind: 'request', categoryId: 'b', label: '빵 요청 6', position: { x: 0.3, y: 0.4 } },
  {
    id: 'm1',
    kind: 'missing',
    categoryId: 'a',
    label: 'X : 과일 / 채소',
    position: { x: 0.5, y: 0.6 },
  },
  { id: 'e1', kind: 'existing', label: '있는 가게 위치', position: { x: 0.7, y: 0.8 } },
  { id: 'e2', kind: 'existing', label: '있는 가게 위치', position: { x: 0.9, y: 0.1 } },
];

const ids = (markers: MapMarker[]) => markers.map((marker) => marker.id);

describe('getVisibleMarkers', () => {
  it('all 이면 모든 마커를 원래 순서대로 돌려준다', () => {
    expect(ids(getVisibleMarkers(MARKERS, 'all'))).toEqual(['r1', 'r2', 'm1', 'e1', 'e2']);
  });

  it.each([
    ['missing', ['m1']],
    ['request', ['r1', 'r2']],
    ['existing', ['e1', 'e2']],
  ] as const)('%s 이면 같은 종류의 마커만 돌려준다', (filter, expected) => {
    expect(ids(getVisibleMarkers(MARKERS, filter))).toEqual(expected);
  });

  it('필터를 바꿔도 마커의 위치는 그대로다', () => {
    const [marker] = getVisibleMarkers(MARKERS, 'missing');

    expect(marker?.position).toEqual({ x: 0.5, y: 0.6 });
  });

  it('원본 배열을 바꾸지 않고, all 도 새 배열을 돌려준다', () => {
    const copy = [...MARKERS];
    const result = getVisibleMarkers(MARKERS, 'all');

    expect(MARKERS).toEqual(copy);
    expect(result).not.toBe(MARKERS);
  });

  it('해당하는 마커가 없으면 빈 배열이다', () => {
    expect(getVisibleMarkers([], 'existing')).toEqual([]);
    expect(getVisibleMarkers(MARKERS.slice(0, 2), 'missing')).toEqual([]);
  });
});

describe('getMarkerSummary', () => {
  it('현재 필터와 표시 개수를 알리는 문구를 만든다', () => {
    expect(getMarkerSummary(3, 'existing')).toBe('현재 있는 가게 3곳 표시 중');
    expect(getMarkerSummary(9, 'all')).toBe('현재 전체 9곳 표시 중');
    expect(getMarkerSummary(0, 'missing')).toBe('현재 없는 가게 0곳 표시 중');
  });
});
