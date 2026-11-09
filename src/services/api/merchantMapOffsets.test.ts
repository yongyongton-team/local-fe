import { describe, expect, it } from 'vitest';
import type { StoreCategory } from '@/types/domain';
import { declutterOffsets } from '../mapCoordinates';
import { OFFSET_DAMPING, mapOwnerMapData } from './mappers';

const FRUIT: StoreCategory = {
  id: '7',
  name: '과일·채소 가게',
  cardTitle: '과일 / 채소 가게',
  requestLabel: '과일',
  missingLabel: '과일 / 채소',
  objectPhrase: '과일·채소 가게를',
  titleLabel: '과일 가게',
  martCheck: true,
};
const AREAS = [
  { dongId: 22, name: '구성동', requestCount: 29, center: { lat: 37.2979, lon: 127.1054 } },
  { dongId: 28, name: '보정동', requestCount: 14, center: { lat: 37.3, lon: 127.12 } },
  { dongId: 23, name: '마북동', requestCount: 9, center: { lat: 37.31, lon: 127.14 } },
];
const context = { shop: { lat: 37.3108, lng: 127.1398 }, category: FRUIT };

describe('사장님 지도 알약의 겹침 보정(API 모드)', () => {
  it('알약마다 라벨 픽셀 오프셋을 받고, 값은 declutterOffsets 를 OFFSET_DAMPING 만큼 줄인 것이다', () => {
    const { markers } = mapOwnerMapData({ areas: AREAS }, context);
    const full = declutterOffsets(markers.map((m) => m.position)); // 줄이기 전 값

    expect(markers.every((m) => m.offset !== undefined)).toBe(true);
    expect(OFFSET_DAMPING).toBeGreaterThan(0);
    expect(OFFSET_DAMPING).toBeLessThan(1);
    markers.forEach((m, i) => {
      // declutterOffsets 는 평균에서의 거리에 비례하므로 줄인 점들의 오프셋은 줄이기 전 값의 OFFSET_DAMPING 배(반올림 오차 1px)다.
      expect(Math.abs((m.offset?.x ?? 0) - (full[i]?.x ?? 0) * OFFSET_DAMPING)).toBeLessThanOrEqual(
        1,
      );
      expect(Math.abs((m.offset?.y ?? 0) - (full[i]?.y ?? 0) * OFFSET_DAMPING)).toBeLessThanOrEqual(
        1,
      );
    });
    // 서로 다른 위치의 알약은 서로 다른 오프셋이라 같은 자리에 겹쳐 그려지지 않는다.
    expect(new Set(markers.map((m) => `${m.offset?.x},${m.offset?.y}`)).size).toBe(3);
  });

  it('좌표(lat, lng)는 서버 center 그대로이고 오프셋 때문에 바뀌지 않는다', () => {
    const { markers, origin } = mapOwnerMapData({ areas: AREAS }, context);

    expect(markers.map((m) => [m.lat, m.lng])).toEqual(
      AREAS.map((a) => [a.center.lat, a.center.lon]),
    );
    expect([origin.lat, origin.lng]).toEqual([37.3108, 127.1398]);
  });

  it('알약이 하나면 오프셋은 0 이고, 좌표가 없는 동네는 오프셋 계산에서 빠진다', () => {
    const one = mapOwnerMapData({ areas: [AREAS[0]!] }, context);
    expect(one.markers[0]?.offset).toEqual({ x: 0, y: 0 });

    const some = mapOwnerMapData(
      { areas: [{ ...AREAS[0]!, center: null }, AREAS[1]!, AREAS[2]!] },
      context,
    );
    expect(some.markers).toHaveLength(2);
    expect(some.markers.every((m) => m.offset !== undefined)).toBe(true);
  });
});
