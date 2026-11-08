/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { act, render, screen, within } from '@testing-library/react';
import { StrictMode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { installFakeNaver } from '@/test/fakeNaverMaps';
import type { MapMarker } from '@/types/domain';
import { NaverMap } from './NaverMap';

const marker = (id: string, overrides: Partial<MapMarker> = {}): MapMarker => ({
  id,
  kind: 'request',
  label: `과일 요청 ${id}`,
  position: { x: 0.5, y: 0.5 },
  lat: 37.3,
  lng: 127.1,
  ...overrides,
});

const A = marker('1', { lat: 37.298, lng: 127.105 });
const B = marker('2', { kind: 'missing', label: 'X : 과일 / 채소', lat: 37.3, lng: 127.108 });
const C = marker('3', { kind: 'existing', label: '있는 가게 위치', lat: 37.302, lng: 127.11 });

const scripts = () => document.querySelectorAll('script[data-naver-map-sdk]');
const useKey = () => vi.stubEnv('VITE_NAVER_MAP_CLIENT_ID', 'test-key');

describe('폴백(MapPlaceholder)', () => {
  it('키가 없으면 SDK 를 불러오지 않고 기존 자리표시자를 문구 없이 보여준다', () => {
    render(<NaverMap markers={[A, B]} label="동네 지도(예시)" />);

    expect(scripts()).toHaveLength(0);
    const region = screen.getByRole('region', { name: '동네 지도(예시)' });
    expect(within(region).getAllByRole('listitem')).toHaveLength(2);
    expect(within(region).getByText('지도 연동 예정 · 예시 데이터')).toBeInTheDocument();
    expect(screen.queryByText('지도를 불러오지 못했어요')).not.toBeInTheDocument();
  });

  it('스크립트를 불러오는 동안에도 자리표시자를 보여준다', () => {
    useKey();
    render(<NaverMap markers={[A]} label="지도" />);

    expect(scripts()).toHaveLength(1);
    expect(screen.getByRole('region', { name: '지도' })).toHaveTextContent('과일 요청 1');
    expect(screen.queryByText('지도를 불러오지 못했어요')).not.toBeInTheDocument();
  });

  it('스크립트 로드에 실패하면 "지도를 불러오지 못했어요" 문구와 함께 자리표시자를 보여준다', () => {
    useKey();
    render(<NaverMap markers={[A]} label="지도" />);

    act(() => {
      scripts()[0]!.dispatchEvent(new Event('error'));
    });

    expect(screen.getByText('지도를 불러오지 못했어요')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '지도' })).toHaveTextContent('과일 요청 1');
  });

  it('인증 실패(navermap_authFailure)에서도 같은 폴백을 보여준다', () => {
    useKey();
    const fake = installFakeNaver();
    render(<NaverMap markers={[A]} label="지도" />);
    expect(fake.maps).toHaveLength(1);

    act(() => {
      window.navermap_authFailure?.();
    });

    expect(screen.getByText('지도를 불러오지 못했어요')).toBeInTheDocument();
    // 실제 지도는 정리된다.
    expect(fake.maps[0]!.destroy).toHaveBeenCalledTimes(1);
  });

  it('origin(기준 핀·반경)이 있으면 아직 지원하지 않으므로 자리표시자를 보여준다', () => {
    useKey();
    const fake = installFakeNaver();
    render(
      <NaverMap
        markers={[A]}
        label="지도"
        origin={{ label: '내 가게 위치', position: { x: 0.5, y: 0.5 }, radiusKm: 3 }}
      />,
    );

    expect(fake.maps).toHaveLength(0);
    expect(screen.getByText('내 가게 위치')).toBeInTheDocument();
  });

  it('마커가 있는데 위도·경도가 하나도 없으면 자리표시자를 보여준다', () => {
    useKey();
    const fake = installFakeNaver();
    const noGeo: MapMarker = { ...A, lat: undefined, lng: undefined };
    render(<NaverMap markers={[noGeo]} label="지도" />);

    expect(fake.maps).toHaveLength(0);
    expect(screen.getByRole('region', { name: '지도' })).toHaveTextContent('과일 요청 1');
  });
});

// CSS 모듈 변환 없이 소스 그대로 읽는다(Vitest 는 프로젝트 루트에서 실행된다).
const mapCss = readFileSync('src/shared/ui/NaverMap.module.css', 'utf8');

/** CSS 소스에서 한 규칙({...})의 본문을 꺼낸다. */
const ruleBody = (css: string, selector: string) =>
  new RegExp(`${selector.replace('.', '\\.')}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? '';

describe('회귀: 키가 유효한데 지도가 회색 영역으로만 보이던 문제', () => {
  // 원인: SDK 가 지도를 만들 때 컨테이너에 인라인 position: relative 를 써서, 컨테이너를
  // position: absolute + inset: 0 으로 크기를 잡던 CSS 가 덮여 높이가 0 이 됐다(타일·마커가 안 보임).
  it('SDK 가 쓰는 컨테이너는 position 에 의존하지 않고 크기를 정하는 틀(.frame) 안을 채운다', () => {
    useKey();
    const fake = installFakeNaver();
    render(<NaverMap markers={[A]} label="지도" />);

    const container = fake.maps[0]!.element;
    // 가짜 SDK 도 실제처럼 컨테이너에 인라인 position: relative 를 쓴다.
    expect(container.style.position).toBe('relative');
    const frame = container.parentElement!;
    expect(frame).toHaveClass('frame');
    expect(frame.parentElement).toBe(screen.getByRole('region', { name: '지도' }));
  });

  it('CSS: 크기는 .frame(absolute + inset 0)이 정하고, SDK 컨테이너(.canvas)는 position·inset 없이 100% 로 채운다', () => {
    const frame = ruleBody(mapCss, '.frame');
    const canvas = ruleBody(mapCss, '.canvas');

    expect(frame).toMatch(/position:\s*absolute/);
    expect(frame).toMatch(/inset:\s*0/);
    expect(canvas).toMatch(/width:\s*100%/);
    expect(canvas).toMatch(/height:\s*100%/);
    // SDK 가 덮어쓰는 속성으로 크기를 잡으면 안 된다.
    expect(canvas).not.toMatch(/position\s*:/);
    expect(canvas).not.toMatch(/inset\s*:|top\s*:|bottom\s*:/);
  });

  it('컨테이너 크기가 바뀌면 지도 크기를 다시 계산하고, 언마운트하면 관찰을 멈춘다', () => {
    useKey();
    const fake = installFakeNaver();
    const observe = vi.fn();
    const disconnect = vi.fn();
    let notify: () => void = () => undefined;
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          notify = callback;
        }
        observe = observe;
        disconnect = disconnect;
      },
    );
    const { unmount } = render(<NaverMap markers={[A]} label="지도" />);

    expect(observe).toHaveBeenCalledWith(fake.maps[0]!.element);
    act(() => notify());
    expect(fake.maps[0]!.autoResize).toHaveBeenCalledTimes(1);

    unmount();
    expect(disconnect).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it('위도·경도가 NaN 이거나 없는 마커는 지도에 올리지 않는다', () => {
    useKey();
    const fake = installFakeNaver();
    render(
      <NaverMap
        markers={[A, { ...B, lat: Number.NaN }, { ...C, lng: Number.POSITIVE_INFINITY }]}
        label="지도"
      />,
    );

    expect(fake.attached()).toHaveLength(1);
    expect(fake.attached()[0]!.options.position).toMatchObject({ lat: 37.298, lng: 127.105 });
  });

  it('fitBounds 입력은 (위도, 경도) 순서의 남서·북동 모서리이고 마커 전체를 감싼다', () => {
    useKey();
    const fake = installFakeNaver();
    render(<NaverMap markers={[A, B, C]} label="지도" />);

    const [bounds] = fake.maps[0]!.fitBounds.mock.calls[0] as [
      { sw: { lat: number; lng: number }; ne: { lat: number; lng: number } },
    ];
    expect(bounds.sw).toMatchObject({ lat: 37.298, lng: 127.105 });
    expect(bounds.ne).toMatchObject({ lat: 37.302, lng: 127.11 });
    // 위도는 37 부근, 경도는 127 부근(뒤바뀌지 않았다)
    expect(bounds.sw.lat).toBeLessThan(90);
    expect(bounds.sw.lng).toBeGreaterThan(100);
  });
});

describe('SDK 예외', () => {
  it('지도 생성이 예외를 던지면 앱을 멈추지 않고 폴백 문구와 자리표시자를 보여준다', () => {
    useKey();
    installFakeNaver();
    vi.spyOn(window.naver.maps, 'Map').mockImplementation(() => {
      throw new Error('sdk broken');
    });
    render(<NaverMap markers={[A]} label="지도" />);

    expect(screen.getByText('지도를 불러오지 못했어요')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '지도' })).toHaveTextContent('과일 요청 1');
  });

  it('마커 갱신이 예외를 던져도 폴백으로 바꾸고 정리가 던지는 예외는 무시한다', () => {
    useKey();
    const fake = installFakeNaver();
    const { rerender } = render(<NaverMap markers={[A]} label="지도" />);
    // 인증 실패 직후처럼 SDK 가 깨져 마커 정리와 지도 파괴가 예외를 던지는 상황
    fake.markers[0]!.setMap.mockImplementation(() => {
      throw new TypeError("Cannot read properties of null (reading 'capitalize')");
    });
    fake.maps[0]!.destroy.mockImplementation(() => {
      throw new Error('destroyed');
    });

    expect(() => rerender(<NaverMap markers={[B]} label="지도" />)).not.toThrow();

    expect(screen.getByText('지도를 불러오지 못했어요')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '지도' })).toHaveTextContent('X : 과일 / 채소');
  });

  it('인증 실패로 지도가 정리될 때 SDK 가 예외를 던져도 앱은 폴백으로 바뀐다', () => {
    useKey();
    const fake = installFakeNaver();
    render(<NaverMap markers={[A, B]} label="지도" />);
    for (const m of fake.markers) {
      m.setMap.mockImplementation(() => {
        throw new TypeError("Cannot read properties of null (reading 'capitalize')");
      });
    }

    expect(() =>
      act(() => {
        window.navermap_authFailure?.();
      }),
    ).not.toThrow();

    expect(screen.getByText('지도를 불러오지 못했어요')).toBeInTheDocument();
  });
});

describe('준비된 지도', () => {
  it('region 과 이름을 가진 컨테이너에 지도를 한 번 만들고 컨트롤을 끈다', () => {
    useKey();
    const fake = installFakeNaver();
    render(<NaverMap markers={[A, B, C]} label="동네 지도(예시)" />);

    const region = screen.getByRole('region', { name: '동네 지도(예시)' });
    expect(fake.maps).toHaveLength(1);
    expect(region.contains(fake.maps[0]!.element)).toBe(true);
    expect(fake.maps[0]!.options).toMatchObject({ zoomControl: false, mapTypeControl: false });
  });

  it('마커를 위도·경도로 만들고 모양은 기존 마커 스타일(알약·핀)을 쓴다', () => {
    useKey();
    const fake = installFakeNaver();
    render(<NaverMap markers={[A, B, C]} label="지도" />);

    const [a, b, c] = fake.markers;
    expect(fake.markers).toHaveLength(3);
    expect(a!.options.position).toMatchObject({ lat: 37.298, lng: 127.105 });
    expect(a!.options.icon.content).toHaveTextContent('과일 요청 1');
    expect(a!.options.icon.content.querySelector('.request')).not.toBeNull();
    expect(b!.options.icon.content.querySelector('.missing')).not.toBeNull();
    expect(c!.options.icon.content.querySelector('svg')).not.toBeNull();
    expect(c!.options.icon.content).toHaveAccessibleName('있는 가게 위치');
    expect(a!.options.icon.anchor).toMatchObject({ x: 0, y: 0 });
  });

  it('마커 전체가 보이게 맞춘다(여러 개는 fitBounds, 하나는 고정 줌)', () => {
    useKey();
    const fake = installFakeNaver();
    const { unmount } = render(<NaverMap markers={[A, B, C]} label="지도" />);

    const [map] = fake.maps;
    expect(map!.fitBounds).toHaveBeenCalledTimes(1);
    const [bounds] = map!.fitBounds.mock.calls[0] as [{ sw: { lat: number }; ne: { lat: number } }];
    expect([bounds.sw.lat, bounds.ne.lat]).toEqual([37.298, 37.302]);
    unmount();

    render(<NaverMap markers={[A]} label="지도" />);
    const single = fake.maps[1]!;
    expect(single.fitBounds).not.toHaveBeenCalled();
    expect(single.setCenter).toHaveBeenCalledTimes(1);
    expect(single.setZoom).toHaveBeenCalledWith(16);
  });

  it('칩 필터처럼 마커가 바뀌면 지도를 다시 만들지 않고 마커만 갱신하며 지도를 움직이지 않는다', () => {
    useKey();
    const fake = installFakeNaver();
    const { rerender } = render(<NaverMap markers={[A, B, C]} label="지도" />);
    const [map] = fake.maps;
    const [a, b, c] = fake.markers;

    // 필터: B 만 남김
    rerender(<NaverMap markers={[B]} label="지도" />);
    expect(fake.maps).toHaveLength(1);
    expect(a!.removed).toBe(true);
    expect(c!.removed).toBe(true);
    expect(b!.removed).toBe(false);
    expect(fake.markers).toHaveLength(3); // 남은 마커는 다시 만들지 않는다

    // 전체로 복귀: A, C 만 새로 만든다
    rerender(<NaverMap markers={[A, B, C]} label="지도" />);
    expect(fake.maps).toHaveLength(1);
    expect(fake.markers).toHaveLength(5);
    expect(fake.attached().map((m) => m.options.icon.content.textContent)).toEqual([
      'X : 과일 / 채소',
      '과일 요청 1',
      '',
    ]);
    expect(map!.destroy).not.toHaveBeenCalled();
    expect(map!.fitBounds).toHaveBeenCalledTimes(1);
  });

  it('같은 마커 목록을 다시 받아도 아무것도 다시 만들지 않는다', () => {
    useKey();
    const fake = installFakeNaver();
    const { rerender } = render(<NaverMap markers={[A, B]} label="지도" />);

    rerender(<NaverMap markers={[{ ...A }, { ...B }]} label="지도" />);

    expect(fake.markers).toHaveLength(2);
    expect(fake.attached()).toHaveLength(2);
  });

  it('마커의 내용(라벨)이 바뀌면 그 마커만 다시 만든다', () => {
    useKey();
    const fake = installFakeNaver();
    const { rerender } = render(<NaverMap markers={[A, B]} label="지도" />);

    rerender(<NaverMap markers={[{ ...A, label: '과일 요청 30' }, B]} label="지도" />);

    expect(fake.markers).toHaveLength(3);
    expect(fake.markers[0]!.removed).toBe(true);
    expect(fake.attached().map((m) => m.options.icon.content.textContent)).toEqual([
      'X : 과일 / 채소',
      '과일 요청 30',
    ]);
  });

  it('마커가 늦게 도착해도 도착한 첫 목록에 맞춰 한 번 맞춘다', () => {
    useKey();
    const fake = installFakeNaver();
    const { rerender } = render(<NaverMap markers={[]} label="지도" />);
    expect(fake.maps[0]!.fitBounds).not.toHaveBeenCalled();

    rerender(<NaverMap markers={[A, B]} label="지도" />);

    expect(fake.maps).toHaveLength(1);
    expect(fake.maps[0]!.fitBounds).toHaveBeenCalledTimes(1);
  });

  it('언마운트하면 마커를 지도에서 떼고 지도를 정리한다', () => {
    useKey();
    const fake = installFakeNaver();
    const { unmount } = render(<NaverMap markers={[A, B, C]} label="지도" />);

    unmount();

    expect(fake.maps[0]!.destroy).toHaveBeenCalledTimes(1);
    expect(fake.attached()).toHaveLength(0);
  });

  it('StrictMode 에서 이펙트가 두 번 실행돼도 살아 있는 지도·마커가 중복되지 않는다', () => {
    useKey();
    const fake = installFakeNaver();
    render(
      <StrictMode>
        <NaverMap markers={[A, B, C]} label="지도" />
      </StrictMode>,
    );

    const alive = fake.maps.filter((m) => m.destroy.mock.calls.length === 0);
    expect(alive).toHaveLength(1);
    expect(fake.attached()).toHaveLength(3);
    expect(scripts()).toHaveLength(0);
  });

  it('요약은 보이지 않는 aria-live 로 알린다', () => {
    useKey();
    installFakeNaver();
    render(<NaverMap markers={[A]} label="지도" summary="현재 전체 1곳 표시 중" />);

    const live = screen.getByText('현재 전체 1곳 표시 중');
    expect(live).toHaveAttribute('aria-live', 'polite');
    expect(live).toHaveClass('visually-hidden');
  });

  it('같은 키로 여러 지도를 함께 써도 <script> 는 한 번만 삽입된다', () => {
    useKey();
    render(
      <>
        <NaverMap markers={[A]} label="하나" />
        <NaverMap markers={[B]} label="둘" />
      </>,
    );

    expect(scripts()).toHaveLength(1);
  });
});

describe('refitOnChange(마커 집합이 바뀔 때 다시 맞추기)', () => {
  const FAR = marker('9', { lat: 37.32, lng: 127.128 });

  it('기본(false)은 처음 한 번만 맞추고 마커 집합이 달라져도 지도를 움직이지 않는다', () => {
    useKey();
    const fake = installFakeNaver();
    const { rerender } = render(<NaverMap markers={[A]} label="지도" />);

    rerender(<NaverMap markers={[A, FAR]} label="지도" />);

    expect(fake.maps[0]!.setCenter).toHaveBeenCalledTimes(1);
    expect(fake.maps[0]!.fitBounds).not.toHaveBeenCalled();
  });

  it('true 이면 마커 집합(id)이 바뀔 때마다 다시 맞추고 지도는 다시 만들지 않는다', () => {
    useKey();
    const fake = installFakeNaver();
    const { rerender } = render(<NaverMap refitOnChange markers={[A]} label="지도" />);
    const [map] = fake.maps;
    expect(map!.setCenter).toHaveBeenCalledTimes(1); // 마커 하나: 고정 줌

    rerender(<NaverMap refitOnChange markers={[A, FAR]} label="지도" />);
    expect(map!.fitBounds).toHaveBeenCalledTimes(1);

    rerender(<NaverMap refitOnChange markers={[A]} label="지도" />);
    expect(map!.setCenter).toHaveBeenCalledTimes(2);
    expect(fake.maps).toHaveLength(1);
    expect(map!.destroy).not.toHaveBeenCalled();
  });

  it('true 여도 같은 마커 집합의 라벨·순서만 바뀌면 지도를 움직이지 않는다', () => {
    useKey();
    const fake = installFakeNaver();
    const { rerender } = render(<NaverMap refitOnChange markers={[A, B]} label="지도" />);

    rerender(<NaverMap refitOnChange markers={[{ ...B, label: '새 라벨' }, A]} label="지도" />);

    expect(fake.maps[0]!.fitBounds).toHaveBeenCalledTimes(1);
  });

  it('true 여도 마커가 없어졌다가 다시 생기면 새로 맞춘다', () => {
    useKey();
    const fake = installFakeNaver();
    const { rerender } = render(<NaverMap refitOnChange markers={[A, B]} label="지도" />);

    rerender(<NaverMap refitOnChange markers={[]} label="지도" />);
    expect(fake.maps[0]!.fitBounds).toHaveBeenCalledTimes(1);
    rerender(<NaverMap refitOnChange markers={[A, B, C]} label="지도" />);

    expect(fake.maps[0]!.fitBounds).toHaveBeenCalledTimes(2);
  });
});

describe('기준점(중심 핀)과 반경 원', () => {
  const origin = (radiusKm: number | null, overrides = {}) => ({
    label: '내 가게 위치',
    position: { x: 0.5, y: 0.5 },
    radiusKm,
    lat: 37.306,
    lng: 127.0913,
    ...overrides,
  });

  it('키가 없으면 SDK 를 쓰지 않고 자리표시자가 핀을 보여준다', () => {
    const fake = installFakeNaver();
    render(<NaverMap markers={[A]} origin={origin(3)} label="지도" />);

    expect(fake.maps).toHaveLength(0);
    expect(fake.circles).toHaveLength(0);
    expect(screen.getByText('내 가게 위치')).toBeInTheDocument();
  });

  it('위도·경도가 없는 origin 은 자리표시자를 보여준다(상대좌표만 있는 기존 데이터)', () => {
    useKey();
    const fake = installFakeNaver();
    render(
      <NaverMap
        markers={[A]}
        origin={origin(3, { lat: undefined, lng: undefined })}
        label="지도"
      />,
    );

    expect(fake.maps).toHaveLength(0);
    expect(screen.getByText('내 가게 위치')).toBeInTheDocument();
  });

  it('원은 반경(km)을 미터로 바꿔 만들고 점선·채움 없음·클릭 불가이며 색은 토큰(CSS 변수)에서 읽는다', () => {
    useKey();
    document.documentElement.style.setProperty('--color-black', 'rgb(1, 2, 3)');
    const fake = installFakeNaver();
    render(<NaverMap markers={[A]} origin={origin(3)} label="지도" />);

    expect(fake.attachedCircles()).toHaveLength(1);
    const [circle] = fake.circles;
    expect(circle!.options).toMatchObject({
      radius: 3000,
      center: { lat: 37.306, lng: 127.0913 },
      strokeStyle: 'shortdash',
      strokeWeight: 1,
      strokeColor: 'rgb(1, 2, 3)',
      fillOpacity: 0,
      clickable: false,
    });
    document.documentElement.style.removeProperty('--color-black');
  });

  it('토큰 값이 없으면 이름 있는 색으로 대신한다(코드에 HEX 를 두지 않는다)', () => {
    useKey();
    const fake = installFakeNaver();
    render(<NaverMap markers={[A]} origin={origin(3)} label="지도" />);

    expect(fake.circles[0]!.options.strokeColor).toBe('black');
  });

  it('중심 핀은 지정한 좌표에 놓이고 핀 그림의 중심이 좌표에 오며 이름을 가진다', () => {
    useKey();
    const fake = installFakeNaver();
    render(<NaverMap markers={[A]} origin={origin(3)} label="지도" />);

    const pin = fake.markers.find(
      (m) => m.options.icon.content.getAttribute('aria-label') === '내 가게 위치',
    );
    expect(pin).toBeDefined();
    expect(pin!.options.position).toMatchObject({ lat: 37.306, lng: 127.0913 });
    expect(pin!.options.icon.anchor).toMatchObject({ x: 8.5, y: 10.5 });
    expect(pin!.options.icon.content.querySelector('svg')).not.toBeNull();
  });

  it('반경이 바뀌면 원 반경만 바꾸고 지도·원·핀을 다시 만들지 않으며 시점은 부드럽게 맞춘다', () => {
    useKey();
    const fake = installFakeNaver();
    const { rerender } = render(<NaverMap markers={[A]} origin={origin(3)} label="지도" />);
    const [map] = fake.maps;
    const markerCount = fake.markers.length;
    expect(map!.fitBounds).toHaveBeenCalledTimes(1);

    rerender(<NaverMap markers={[A]} origin={origin(5)} label="지도" />);

    expect(fake.maps).toHaveLength(1);
    expect(fake.circles).toHaveLength(1);
    expect(fake.markers).toHaveLength(markerCount);
    expect(fake.circles[0]!.setRadius).toHaveBeenCalledWith(5000);
    expect(fake.circles[0]!.radius).toBe(5000);
    expect(map!.destroy).not.toHaveBeenCalled();
    // 원 전체가 보이게 다시 맞추되 바로 맞추지 않고 부드럽게(panToBounds) 이동한다.
    expect(map!.fitBounds).toHaveBeenCalledTimes(1);
    expect(map!.panToBounds).toHaveBeenCalledTimes(1);
    const [bounds] = map!.panToBounds.mock.calls[0] as [
      { sw: { lat: number }; ne: { lat: number } },
    ];
    expect(bounds.ne.lat - 37.306).toBeCloseTo(5 / 111.32, 3);
  });

  it('처음 시점은 원 전체와 마커를 감싼다', () => {
    useKey();
    const fake = installFakeNaver();
    render(<NaverMap markers={[A]} origin={origin(3)} label="지도" />);

    const [bounds] = fake.maps[0]!.fitBounds.mock.calls[0] as [
      { sw: { lat: number; lng: number }; ne: { lat: number; lng: number } },
    ];
    expect(37.306 - bounds.sw.lat).toBeGreaterThanOrEqual(3 / 111.32 - 1e-6);
    expect(bounds.ne.lat - 37.306).toBeGreaterThanOrEqual(3 / 111.32 - 1e-6);
    expect(bounds.sw.lng).toBeLessThan(127.0913);
    expect(bounds.ne.lng).toBeGreaterThan(127.0913);
  });

  it('반경 제한이 없으면(null) 원을 만들지 않고 핀과 마커 전체가 보이게 맞춘다', () => {
    useKey();
    const fake = installFakeNaver();
    render(<NaverMap markers={[A, B]} origin={origin(null)} label="지도" />);

    expect(fake.circles).toHaveLength(0);
    expect(
      fake
        .attached()
        .some((m) => m.options.icon.content.getAttribute('aria-label') === '내 가게 위치'),
    ).toBe(true);
    const [bounds] = fake.maps[0]!.fitBounds.mock.calls[0] as [
      { sw: { lat: number }; ne: { lat: number } },
    ];
    // 핀(37.306)과 마커(37.298·37.3)를 모두 감싼다. 원이 없으니 3km 만큼 넓지 않다.
    expect(bounds.sw.lat).toBeCloseTo(37.298, 5);
    expect(bounds.ne.lat).toBeCloseTo(37.306, 5);
  });

  it('반경이 숫자에서 null 이 되면 원을 지우고, 다시 숫자가 되면 새로 만든다', () => {
    useKey();
    const fake = installFakeNaver();
    const { rerender } = render(<NaverMap markers={[A]} origin={origin(3)} label="지도" />);

    rerender(<NaverMap markers={[A]} origin={origin(null)} label="지도" />);
    expect(fake.attachedCircles()).toHaveLength(0);
    expect(fake.circles[0]!.removed).toBe(true);
    expect(fake.maps).toHaveLength(1);

    rerender(<NaverMap markers={[A]} origin={origin(5)} label="지도" />);
    expect(fake.attachedCircles()).toHaveLength(1);
    expect(fake.circles).toHaveLength(2);
    expect(fake.circles[1]!.options.radius).toBe(5000);
  });

  it('값이 같은 origin 을 새 객체로 다시 받아도 아무것도 갱신하지 않는다', () => {
    useKey();
    const fake = installFakeNaver();
    const { rerender } = render(<NaverMap markers={[A]} origin={origin(3)} label="지도" />);

    rerender(<NaverMap markers={[A]} origin={origin(3)} label="지도" />);

    expect(fake.circles[0]!.setRadius).not.toHaveBeenCalled();
    expect(fake.maps[0]!.panToBounds).not.toHaveBeenCalled();
    expect(fake.maps[0]!.fitBounds).toHaveBeenCalledTimes(1);
  });

  it('핀 좌표가 바뀌면 핀과 원 중심만 옮긴다', () => {
    useKey();
    const fake = installFakeNaver();
    const { rerender } = render(<NaverMap markers={[A]} origin={origin(3)} label="지도" />);

    rerender(
      <NaverMap markers={[A]} origin={origin(3, { lat: 37.31, lng: 127.09 })} label="지도" />,
    );

    expect(fake.circles[0]!.setCenter).toHaveBeenCalledWith(
      expect.objectContaining({ lat: 37.31, lng: 127.09 }),
    );
    expect(fake.circles).toHaveLength(1);
    expect(fake.maps).toHaveLength(1);
  });

  it('마커가 늦게 도착하면(처음 생길 때) 마커까지 보이게 한 번 다시 맞춘다', () => {
    useKey();
    const fake = installFakeNaver();
    const { rerender } = render(<NaverMap markers={[]} origin={origin(null)} label="지도" />);
    expect(fake.maps[0]!.setCenter).toHaveBeenCalledTimes(1); // 점 하나: 고정 줌

    rerender(<NaverMap markers={[A, B]} origin={origin(null)} label="지도" />);

    expect(fake.maps[0]!.fitBounds).toHaveBeenCalledTimes(1);
  });

  it('언마운트하면 원과 핀과 마커를 지도에서 떼고 지도를 정리한다', () => {
    useKey();
    const fake = installFakeNaver();
    const { unmount } = render(<NaverMap markers={[A, B]} origin={origin(3)} label="지도" />);
    expect(fake.attachedCircles()).toHaveLength(1);

    unmount();

    expect(fake.attachedCircles()).toHaveLength(0);
    expect(fake.attached()).toHaveLength(0);
    expect(fake.maps[0]!.destroy).toHaveBeenCalledTimes(1);
  });

  it('StrictMode 에서도 살아 있는 원은 하나, 핀은 하나다', () => {
    useKey();
    const fake = installFakeNaver();
    render(
      <StrictMode>
        <NaverMap markers={[A]} origin={origin(3)} label="지도" />
      </StrictMode>,
    );

    expect(fake.attachedCircles()).toHaveLength(1);
    expect(
      fake
        .attached()
        .filter((m) => m.options.icon.content.getAttribute('aria-label') === '내 가게 위치'),
    ).toHaveLength(1);
  });

  it('원 생성이 예외를 던지면 앱을 멈추지 않고 폴백 문구와 자리표시자를 보여준다', () => {
    useKey();
    installFakeNaver();
    vi.spyOn(window.naver.maps, 'Circle').mockImplementation(() => {
      throw new Error('circle broken');
    });
    render(<NaverMap markers={[A]} origin={origin(3)} label="지도" />);

    expect(screen.getByText('지도를 불러오지 못했어요')).toBeInTheDocument();
    expect(screen.getByText('내 가게 위치')).toBeInTheDocument();
  });

  it('반경을 바꾸다 원 갱신이 예외를 던져도 폴백으로 바꾸고 정리 중 예외는 무시한다', () => {
    useKey();
    const fake = installFakeNaver();
    const { rerender } = render(<NaverMap markers={[A]} origin={origin(3)} label="지도" />);
    fake.circles[0]!.setRadius.mockImplementation(() => {
      throw new Error('setRadius broken');
    });
    fake.circles[0]!.setMap.mockImplementation(() => {
      throw new TypeError("Cannot read properties of null (reading 'capitalize')");
    });

    expect(() =>
      rerender(<NaverMap markers={[A]} origin={origin(5)} label="지도" />),
    ).not.toThrow();

    expect(screen.getByText('지도를 불러오지 못했어요')).toBeInTheDocument();
  });

  it('인증 실패에서도 폴백을 보여주고 원·핀 정리가 예외를 던져도 앱은 멈추지 않는다', () => {
    useKey();
    const fake = installFakeNaver();
    render(<NaverMap markers={[A]} origin={origin(3)} label="지도" />);
    fake.circles[0]!.setMap.mockImplementation(() => {
      throw new TypeError('broken after auth failure');
    });

    expect(() =>
      act(() => {
        window.navermap_authFailure?.();
      }),
    ).not.toThrow();

    expect(screen.getByText('지도를 불러오지 못했어요')).toBeInTheDocument();
    expect(screen.getByText('내 가게 위치')).toBeInTheDocument();
  });
});

describe('반경 제한 없음 + 보여줄 범위(areaBounds, 예: 기흥구 전체)', () => {
  const AREA = { sw: { lat: 37.21, lng: 127.055 }, ne: { lat: 37.335, lng: 127.17 } };
  const origin = (radiusKm: number | null, overrides = {}) => ({
    label: '내 가게 위치',
    position: { x: 0.5, y: 0.5 },
    radiusKm,
    lat: 37.2985,
    lng: 127.1085,
    areaBounds: AREA,
    ...overrides,
  });
  type Bounds = { sw: { lat: number; lng: number }; ne: { lat: number; lng: number } };

  it('처음부터 반경 제한이 없으면 원 없이 범위 전체로 맞춘다(라벨용 여백 없음)', () => {
    useKey();
    const fake = installFakeNaver();
    render(<NaverMap markers={[A, B]} origin={origin(null)} label="지도" />);

    expect(fake.circles).toHaveLength(0);
    const [bounds, options] = fake.maps[0]!.fitBounds.mock.calls[0] as [Bounds, { right: number }];
    expect(bounds.sw).toMatchObject(AREA.sw);
    expect(bounds.ne).toMatchObject(AREA.ne);
    expect(options.right).toBe(16);
  });

  it('반경 칩에서 제한 없음으로 바꾸면 원을 지우고 범위 전체로 부드럽게 이동한다', () => {
    useKey();
    const fake = installFakeNaver();
    const { rerender } = render(<NaverMap markers={[A]} origin={origin(3)} label="지도" />);

    rerender(<NaverMap markers={[A]} origin={origin(null)} label="지도" />);

    expect(fake.attachedCircles()).toHaveLength(0);
    expect(fake.maps).toHaveLength(1);
    expect(fake.maps[0]!.fitBounds).toHaveBeenCalledTimes(1); // 처음 한 번(3km 원)
    expect(fake.maps[0]!.panToBounds).toHaveBeenCalledTimes(1);
    const [bounds] = fake.maps[0]!.panToBounds.mock.calls[0] as [Bounds];
    expect(bounds.sw).toMatchObject(AREA.sw);
    expect(bounds.ne).toMatchObject(AREA.ne);
  });

  it('범위가 있어도 3km·5km 는 기존대로 원과 원 전체 시점이다', () => {
    useKey();
    const fake = installFakeNaver();
    const { rerender } = render(<NaverMap markers={[A]} origin={origin(3)} label="지도" />);
    const [first] = fake.maps[0]!.fitBounds.mock.calls[0] as [Bounds];
    expect(first.ne.lat - 37.2985).toBeCloseTo(3 / 111.32, 3);
    expect(fake.circles[0]!.options.radius).toBe(3000);

    rerender(<NaverMap markers={[A]} origin={origin(5)} label="지도" />);
    expect(fake.circles[0]!.setRadius).toHaveBeenCalledWith(5000);
    const [toFive] = fake.maps[0]!.panToBounds.mock.calls[0] as [Bounds];
    expect(toFive.ne.lat - 37.2985).toBeCloseTo(5 / 111.32, 3);
    // 5km 원은 범위(기흥구)보다 좁다: 범위로 맞추지 않았다.
    expect(toFive.ne.lat).toBeLessThan(AREA.ne.lat + 1);
    expect(toFive.sw.lat).toBeGreaterThan(AREA.sw.lat);

    // 제한 없음 → 다시 3km: 원을 새로 만들고 원 전체로 이동한다.
    rerender(<NaverMap markers={[A]} origin={origin(null)} label="지도" />);
    rerender(<NaverMap markers={[A]} origin={origin(3)} label="지도" />);
    expect(fake.attachedCircles()).toHaveLength(1);
    expect(fake.attachedCircles()[0]!.options.radius).toBe(3000);
    const calls = fake.maps[0]!.panToBounds.mock.calls;
    const [backToThree] = calls[calls.length - 1] as [Bounds];
    expect(backToThree.ne.lat - 37.2985).toBeCloseTo(3 / 111.32, 3);
  });

  it('핀이나 마커가 범위 밖이면 그것까지 함께 감싼다(범위 값이 틀려도 핀·마커는 보인다)', () => {
    useKey();
    const fake = installFakeNaver();
    const outside = marker('out', { lat: 37.4, lng: 127.3 });
    render(<NaverMap markers={[A, outside]} origin={origin(null)} label="지도" />);

    const [bounds] = fake.maps[0]!.fitBounds.mock.calls[0] as [Bounds];
    expect(bounds.sw).toMatchObject(AREA.sw);
    expect(bounds.ne).toMatchObject({ lat: 37.4, lng: 127.3 });
  });

  it('값이 같은 범위를 새 객체로 다시 받아도 시점을 다시 맞추지 않는다', () => {
    useKey();
    const fake = installFakeNaver();
    const { rerender } = render(<NaverMap markers={[A]} origin={origin(null)} label="지도" />);

    rerender(
      <NaverMap
        markers={[A]}
        origin={origin(null, { areaBounds: { sw: { ...AREA.sw }, ne: { ...AREA.ne } } })}
        label="지도"
      />,
    );

    expect(fake.maps[0]!.fitBounds).toHaveBeenCalledTimes(1);
    expect(fake.maps[0]!.panToBounds).not.toHaveBeenCalled();
  });

  it('범위 값이 숫자가 아니면 범위 없이(핀·마커 전체) 맞춘다', () => {
    useKey();
    const fake = installFakeNaver();
    render(
      <NaverMap
        markers={[A, B]}
        origin={origin(null, { areaBounds: { sw: { lat: Number.NaN, lng: 127 }, ne: AREA.ne } })}
        label="지도"
      />,
    );

    const [bounds, options] = fake.maps[0]!.fitBounds.mock.calls[0] as [Bounds, { right: number }];
    // 핀(37.2985)과 마커(37.298·37.3)만 감싼다: 기흥구 범위(37.335)까지 넓히지 않는다.
    expect(bounds.ne.lat).toBeCloseTo(37.3, 5);
    expect(bounds.sw.lat).toBeCloseTo(37.298, 5);
    expect(options.right).toBe(16 + 140);
  });
});
