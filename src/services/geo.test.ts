import { describe, expect, it } from 'vitest';
import { circleBounds, haversineKm } from './geo';

describe('haversineKm', () => {
  it('같은 지점은 0km 이다', () => {
    expect(haversineKm({ lat: 37.3, lng: 127.1 }, { lat: 37.3, lng: 127.1 })).toBe(0);
  });

  it('위도 1° 차이는 약 111.2km 이다', () => {
    expect(haversineKm({ lat: 37, lng: 127 }, { lat: 38, lng: 127 })).toBeCloseTo(111.2, 1);
  });

  it('경도 1° 는 위도가 높을수록 짧다(37.3° 에서 약 88.4km)', () => {
    expect(haversineKm({ lat: 37.3, lng: 127 }, { lat: 37.3, lng: 128 })).toBeCloseTo(88.4, 0);
  });

  it('대칭이다', () => {
    const a = { lat: 37.2979, lng: 127.1054 };
    const b = { lat: 37.32, lng: 127.112 };

    expect(haversineKm(a, b)).toBeCloseTo(haversineKm(b, a), 10);
  });
});

describe('circleBounds', () => {
  const center = { lat: 37.3, lng: 127.1 };

  it('중심을 가운데 두고 반경만큼 남북으로 벌어진다(위도 1° ≈ 111.32km)', () => {
    const { sw, ne } = circleBounds(center, 3);

    expect(ne.lat - center.lat).toBeCloseTo(3 / 111.32, 6);
    expect(center.lat - sw.lat).toBeCloseTo(3 / 111.32, 6);
    expect(sw.lng).toBeLessThan(center.lng);
    expect(ne.lng).toBeGreaterThan(center.lng);
  });

  it('모서리가 원을 감싼다: 동서·남북 끝점까지의 거리가 반경 이상이다', () => {
    const { sw, ne } = circleBounds(center, 3);

    expect(haversineKm(center, { lat: ne.lat, lng: center.lng })).toBeGreaterThanOrEqual(2.99);
    expect(haversineKm(center, { lat: center.lat, lng: ne.lng })).toBeGreaterThanOrEqual(2.99);
    expect(haversineKm(center, { lat: center.lat, lng: sw.lng })).toBeGreaterThanOrEqual(2.99);
  });

  it('반경이 클수록 더 넓다', () => {
    expect(circleBounds(center, 5).ne.lat).toBeGreaterThan(circleBounds(center, 3).ne.lat);
  });
});
