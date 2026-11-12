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
  panToBounds: ReturnType<typeof vi.fn>;
  getCenter: ReturnType<typeof vi.fn>;
  /** 지금 지도 중심. setCenter 나 moveTo 로 바뀐다. */
  center: { lat: number; lng: number };
  /** addListener 로 등록된 이벤트 처리기(이벤트 이름별) */
  listeners: Record<string, (() => void)[]>;
  /** 사용자가 지도를 움직인 것처럼 중심을 옮기고 dragstart → idle 이벤트를 낸다. */
  drag: (lat: number, lng: number) => void;
  /** 이벤트 하나를 낸다(등록된 처리기를 모두 부른다). */
  emit: (name: string) => void;
}

export interface FakeMarker {
  options: {
    map?: FakeMap;
    position: { lat: number; lng: number };
    icon: { content: HTMLElement; anchor: { x: number; y: number } };
    /** 클릭할 수 있는 마커인지(주민 탐색의 가게 핀만 true) */
    clickable?: boolean;
  };
  /** addListener 로 등록된 이벤트 처리기(이벤트 이름별). 마커가 지도에서 떨어지면 해제되어야 한다. */
  listeners: Record<string, (() => void)[]>;
  /** 사용자가 마커를 누른 것처럼 click 이벤트를 낸다(clickable 이 아니면 아무 일도 없다). */
  click: () => void;
  /** setMap(null) 로 지도에서 떼어졌는지 */
  removed: boolean;
  setMap: ReturnType<typeof vi.fn>;
  setPosition: ReturnType<typeof vi.fn>;
}

export interface FakeCircle {
  options: {
    map?: FakeMap;
    center: { lat: number; lng: number };
    radius: number;
    strokeColor: string;
    strokeStyle: string;
    strokeWeight: number;
    fillOpacity: number;
  };
  /** 지금 반경(m)과 중심. setRadius·setCenter 로 바뀐다. */
  radius: number;
  center: { lat: number; lng: number };
  removed: boolean;
  setMap: ReturnType<typeof vi.fn>;
  setRadius: ReturnType<typeof vi.fn>;
  setCenter: ReturnType<typeof vi.fn>;
  getBounds: ReturnType<typeof vi.fn>;
}

/** 가짜 지오코더가 한 번 받은 검색 */
export interface FakeGeocodeCall {
  query: string;
}

export interface FakeNaver {
  /** 주소 검색(naver.maps.Service.geocode)이 받은 호출 */
  geocodeCalls: FakeGeocodeCall[];
  /**
   * 주소 검색 결과를 정한다. 좌표 하나(첫 결과), null(결과 없음), 'error'(상태 오류)를 돌려주는 함수.
   * 기본은 결과 없음이다.
   */
  setGeocode: (handler: (query: string) => { lat: number; lng: number } | null | 'error') => void;
  maps: FakeMap[];
  markers: FakeMarker[];
  circles: FakeCircle[];
  /** 지금 지도에 붙어 있는 원 */
  attachedCircles: () => FakeCircle[];
  /** 지금 지도에 붙어 있는 마커 */
  attached: () => FakeMarker[];
  /** 지금 등록되어 있는 이벤트 처리기 수(지도와 마커 전체). 정리(리스너 해제)를 확인하는 데 쓴다. */
  listenerCount: () => number;
}

/** window.naver 에 가짜 SDK 를 주입한다. 테스트가 끝나면 setup.ts 가 지운다. */
export function installFakeNaver(): FakeNaver {
  let geocodeHandler: Parameters<FakeNaver['setGeocode']>[0] = () => null;
  const fake: FakeNaver = {
    geocodeCalls: [],
    setGeocode: (handler) => {
      geocodeHandler = handler;
    },
    maps: [],
    markers: [],
    circles: [],
    attachedCircles: () => fake.circles.filter((c) => !c.removed),
    attached: () => fake.markers.filter((m) => !m.removed),
    listenerCount: () =>
      [...fake.maps, ...fake.markers].reduce(
        (sum, target) =>
          sum + Object.values(target.listeners).reduce((n, list) => n + list.length, 0),
        0,
      ),
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
      const initial = options.center as { lat: number; lng: number } | undefined;
      self.center = initial ? { lat: initial.lat, lng: initial.lng } : { lat: 0, lng: 0 };
      self.listeners = {};
      self.getCenter = vi.fn(() => new LatLng(self.center.lat, self.center.lng));
      self.emit = (name) => (self.listeners[name] ?? []).forEach((listener) => listener());
      self.drag = (lat, lng) => {
        self.emit('dragstart');
        self.center = { lat, lng };
        self.emit('idle');
      };
      self.setCenter = vi.fn((center: { lat: number; lng: number }) => {
        self.center = { lat: center.lat, lng: center.lng };
      });
      self.setZoom = vi.fn();
      self.fitBounds = vi.fn();
      self.autoResize = vi.fn();
      self.panToBounds = vi.fn();
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
      self.listeners = {};
      self.click = () => {
        if (options.clickable) (self.listeners.click ?? []).forEach((listener) => listener());
      };
      self.setMap = vi.fn((map: FakeMap | null) => {
        if (map === null) self.removed = true;
      });
      self.setPosition = vi.fn((position: { lat: number; lng: number }) => {
        self.options.position = position;
      });
      fake.markers.push(self);
    }
  }
  class Circle {
    constructor(options: FakeCircle['options']) {
      const self = this as unknown as FakeCircle;
      self.options = options;
      self.radius = options.radius;
      self.center = options.center;
      self.removed = false;
      self.setMap = vi.fn((map: FakeMap | null) => {
        if (map === null) self.removed = true;
      });
      self.setRadius = vi.fn((radius: number) => {
        self.radius = radius;
      });
      self.setCenter = vi.fn((center: { lat: number; lng: number }) => {
        self.center = center;
      });
      self.getBounds = vi.fn(() => ({ sw: self.center, ne: self.center }));
      fake.circles.push(self);
    }
  }

  // 실제 SDK 의 Event.addListener(target, name, handler) 와 removeListener(listeners)
  interface FakeListener {
    target: { listeners: Record<string, (() => void)[]> };
    name: string;
    handler: () => void;
  }
  const Event = {
    addListener: (
      target: { listeners: Record<string, (() => void)[]> },
      name: string,
      handler: () => void,
    ): FakeListener => {
      (target.listeners[name] ??= []).push(handler);
      return { target, name, handler };
    },
    removeListener: (listeners: FakeListener | FakeListener[]) => {
      for (const { target, name, handler } of [listeners].flat()) {
        target.listeners[name] = (target.listeners[name] ?? []).filter((h) => h !== handler);
      }
    },
  };
  // 주소 검색: 실제처럼 콜백(status, response)으로 돌려준다. 좌표는 문자열 x(경도)·y(위도)다.
  const Service = {
    Status: { OK: 200, ERROR: 500 },
    geocode: (
      options: { query: string },
      callback: (status: number, response: unknown) => void,
    ) => {
      fake.geocodeCalls.push({ query: options.query });
      const result = geocodeHandler(options.query);
      if (result === 'error') {
        callback(500, { v2: { status: 'SYSTEM_ERROR', addresses: [] } });
        return;
      }
      callback(200, {
        v2: {
          status: 'OK',
          addresses: result ? [{ x: String(result.lng), y: String(result.lat) }] : [],
        },
      });
    },
  };

  Object.defineProperty(window, 'naver', {
    configurable: true,
    writable: true,
    value: { maps: { Map, Marker, Circle, LatLng, LatLngBounds, Point, Event, Service } },
  });
  return fake;
}
