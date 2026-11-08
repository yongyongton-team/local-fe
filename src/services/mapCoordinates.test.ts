import { describe, expect, it } from 'vitest';
import { demandService } from '.';
import { GEO_SPREAD, spreadAroundCenter } from './mapCoordinates';

const center = { lat: 37.3, lng: 127.1 };

describe('spreadAroundCenter', () => {
  it('상대좌표 (0.5, 0.5)는 동네 중심이다', () => {
    expect(spreadAroundCenter(center, { x: 0.5, y: 0.5 })).toEqual(center);
  });

  it('오른쪽·아래는 동쪽·남쪽이다(경도 증가, 위도 감소)', () => {
    const p = spreadAroundCenter(center, { x: 1, y: 1 });

    expect(p.lng).toBeCloseTo(center.lng + GEO_SPREAD.lng / 2);
    expect(p.lat).toBeCloseTo(center.lat - GEO_SPREAD.lat / 2);
  });

  it('입력을 바꾸지 않는다', () => {
    const input = { lat: 37.3, lng: 127.1 };
    spreadAroundCenter(input, { x: 0, y: 0 });

    expect(input).toEqual({ lat: 37.3, lng: 127.1 });
  });
});

describe('지도 마커 좌표(서비스 계층)', () => {
  it('세 동네 모든 마커에 기흥구 부근의 임시 위도·경도가 있다', async () => {
    for (const id of ['guseong', 'bojeong', 'mabuk']) {
      const markers = await demandService.listMapMarkers(id);

      expect(markers.length).toBeGreaterThan(0);
      for (const marker of markers) {
        expect(marker.lat).toBeGreaterThan(37.2);
        expect(marker.lat).toBeLessThan(37.4);
        expect(marker.lng).toBeGreaterThan(127.0);
        expect(marker.lng).toBeLessThan(127.2);
      }
    }
  });

  it('같은 동의 마커는 서로 다른 좌표로 흩어져 겹치지 않는다', async () => {
    const markers = await demandService.listMapMarkers('guseong');
    const spots = new Set(markers.map((m) => `${m.lat}|${m.lng}`));

    expect(spots.size).toBe(markers.length);
  });

  it('상대좌표(position)는 그대로 유지한다(자리표시자 지도용)', async () => {
    const [first] = await demandService.listMapMarkers('guseong');

    expect(first?.position.x).toBeGreaterThan(0);
    expect(first?.position.x).toBeLessThan(1);
  });
});
