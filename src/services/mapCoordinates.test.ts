import { describe, expect, it } from 'vitest';
import { demandService } from '.';
import { GEO_SPREAD, declutterOffsets, spreadAroundCenter } from './mapCoordinates';

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

describe('declutterOffsets(라벨 픽셀 보정)', () => {
  it('마커가 없으면 빈 배열, 하나면 보정이 없다', () => {
    expect(declutterOffsets([])).toEqual([]);
    expect(declutterOffsets([{ x: 0.3, y: 0.4 }])).toEqual([{ x: 0, y: 0 }]);
  });

  it('평균 위치를 기준으로 상대 배치를 그대로 옮긴다(위쪽은 음수 y, 왼쪽은 음수 x)', () => {
    const [left, top, right] = declutterOffsets([
      { x: 0.1, y: 0.6 },
      { x: 0.4, y: 0.2 },
      { x: 0.7, y: 0.6 },
    ]);

    expect(left!.x).toBeLessThan(0);
    expect(right!.x).toBeGreaterThan(0);
    expect(top!.y).toBeLessThan(0);
    expect(left!.y).toBe(right!.y);
    expect(left!.x + top!.x + right!.x).toBeCloseTo(0, 0);
  });

  it('같은 동의 사장님 마커 세 개는 라벨(약 85×26px)이 서로 겹치지 않는 간격이 된다', async () => {
    const { merchantService } = await import('.');
    const { markers } = await merchantService.getMapData();
    const boxes = markers.map((m) => ({ x: m.offset!.x, y: m.offset!.y, w: 86, h: 26 }));

    expect(boxes).toHaveLength(3);
    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) {
        const a = boxes[i]!;
        const b = boxes[j]!;
        const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
        expect(overlap).toBe(false);
      }
    }
  });

  it('입력을 바꾸지 않는다', () => {
    const input = [{ x: 0.1, y: 0.2 }];
    declutterOffsets(input);

    expect(input).toEqual([{ x: 0.1, y: 0.2 }]);
  });
});
