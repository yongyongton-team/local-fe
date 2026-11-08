import { vi } from 'vitest';

/** 가짜 지도 인스턴스가 받은 호출을 기록한다. 실제 SDK 와 네트워크 없이 NaverMap 을 검증하는 데 쓴다. */
export interface FakeMap {
  element: HTMLElement;
  options: Record<string, unknown>;
  destroy: ReturnType<typeof vi.fn>;
  setCenter: ReturnType<typeof vi.fn>;
  setZoom: ReturnType<typeof vi.fn>;
  fitBounds: ReturnType<typeof vi.fn>;
  autoResize: ReturnType<typeof vi.fn>;
}

export interface FakeMarker {
  options: {
    map?: FakeMap;
    position: { lat: number; lng: number };
    icon: { content: HTMLElement; anchor: { x: number; y: number } };
  };
  /** setMap(null) 로 지도에서 떼어졌는지 */
  removed: boolean;
  setMap: ReturnType<typeof vi.fn>;
}

export interface FakeNaver {
  maps: FakeMap[];
  markers: FakeMarker[];
  /** 지금 지도에 붙어 있는 마커 */
  attached: () => FakeMarker[];
}

/** window.naver 에 가짜 SDK 를 주입한다. 테스트가 끝나면 setup.ts 가 지운다. */
export function installFakeNaver(): FakeNaver {
  const fake: FakeNaver = {
    maps: [],
    markers: [],
    attached: () => fake.markers.filter((m) => !m.removed),
  };

  // erasableSyntaxOnly 때문에 생성자 매개변수 속성 대신 필드를 직접 선언한다.
  class LatLng {
    lat: number;
    lng: number;
    constructor(lat: number, lng: number) {
      this.lat = lat;
      this.lng = lng;
    }
  }
  class Point {
    x: number;
    y: number;
    constructor(x: number, y: number) {
      this.x = x;
      this.y = y;
    }
  }
  class LatLngBounds {
    sw: LatLng;
    ne: LatLng;
    constructor(sw: LatLng, ne: LatLng) {
      this.sw = sw;
      this.ne = ne;
    }
  }
  class Map {
    constructor(element: HTMLElement, options: Record<string, unknown>) {
      const self = this as unknown as FakeMap;
      self.element = element;
      self.options = options;
      self.destroy = vi.fn();
      self.setCenter = vi.fn();
      self.setZoom = vi.fn();
      self.fitBounds = vi.fn();
      self.autoResize = vi.fn();
      // 실제 SDK 처럼 컨테이너에 인라인 스타일을 쓴다. (position 을 relative 로 바꾸므로 컨테이너의 크기를
      // absolute/inset 으로 잡으면 높이가 0 이 된다. 이 동작이 회귀 테스트의 전제다.)
      element.style.position = 'relative';
      element.style.overflow = 'hidden';
      fake.maps.push(self);
    }
  }
  class Marker {
    constructor(options: FakeMarker['options']) {
      const self = this as unknown as FakeMarker;
      self.options = options;
      self.removed = false;
      self.setMap = vi.fn((map: FakeMap | null) => {
        if (map === null) self.removed = true;
      });
      fake.markers.push(self);
    }
  }

  Object.defineProperty(window, 'naver', {
    configurable: true,
    writable: true,
    value: { maps: { Map, Marker, LatLng, LatLngBounds, Point } },
  });
  return fake;
}
