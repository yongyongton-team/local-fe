import { circleBounds } from '@/services/geo';
import type { GeoBounds, MapOrigin } from '@/types/domain';
import { PIN_SIZE, buildPinSvg } from './icons';
import placeholderStyles from './MapPlaceholder.module.css';
import { FIT_MAX_ZOOM, SINGLE_MARKER_ZOOM, type GeoMarker } from './naverMapMarkers';

/*
 * 네이버 지도의 기준점(내 가게 중심 핀)과 반경 원. 자리표시자(MapPlaceholder)의 핀·점선 원과 같은 디자인을
 * 실제 좌표에 그린다. 원의 크기는 자리표시자의 고정 비율이 아니라 실제 반경(km → m)이다.
 */

/** 위도·경도가 있는 기준점(실제 지도가 쓰는 값만). 상대좌표(position)는 쓰지 않는다. */
export type GeoOrigin = Pick<MapOrigin, 'label' | 'radiusKm'> & {
  lat: number;
  lng: number;
  /** 반경 제한이 없을 때 맞출 범위(예: 기흥구 전체) */
  areaBounds?: GeoBounds;
};

const isFiniteBounds = (b: GeoBounds | undefined): b is GeoBounds =>
  b !== undefined && [b.sw.lat, b.sw.lng, b.ne.lat, b.ne.lng].every(Number.isFinite);

/** origin 에 유한한 위도·경도가 있으면 GeoOrigin 으로, 없으면 undefined 로 바꾼다. */
export function toGeoOrigin(origin: MapOrigin | undefined): GeoOrigin | undefined {
  if (!origin || !Number.isFinite(origin.lat) || !Number.isFinite(origin.lng)) return undefined;
  return {
    label: origin.label,
    radiusKm: origin.radiusKm,
    lat: origin.lat as number,
    lng: origin.lng as number,
    ...(isFiniteBounds(origin.areaBounds) && { areaBounds: origin.areaBounds }),
  };
}

/** 반경 원의 선: 자리표시자의 1px 점선과 같다. SDK 옵션은 JS 값이라 CSS 가 아닌 여기서 정한다. */
const RING_STROKE_WEIGHT = 1;
const RING_STROKE_STYLE: naver.maps.StrokeStyleType = 'shortdash';
/** 자리표시자의 원은 채움이 없다. */
const RING_FILL_OPACITY = 0;
/**
 * [임의] 원 전체를 맞출 때의 여백(px). 지도 줌은 정수 단계라 여백이 크면 원이 한 단계 작게 그려져
 * 마커 라벨이 서로 덮이므로, 원이 가장자리에서 잘리지 않는 최소한으로 줄였다.
 */
const ORIGIN_FIT_MARGIN = 16;
/**
 * [임의] 반경 제한이 없을 때 마커 라벨이 오른쪽·아래로 잘리지 않게 더하는 여백(px).
 * 라벨(알약 약 85×26px)은 좌표의 오른쪽 아래에 놓이고 픽셀 보정으로 더 옮겨질 수 있다.
 */
const LABEL_EXTRA_MARGIN = { right: 140, bottom: 30 } as const;
/** 반경이 바뀔 때 시점이 부드럽게 이동하는 시간(ms) */
const PAN_DURATION_MS = 300;

/**
 * 디자인 토큰(CSS 변수)의 값을 런타임에 읽는다. SDK 옵션은 CSS 를 쓸 수 없어 코드에 HEX 를 쓰는 대신 토큰을 참조한다.
 * 변수가 없으면 이름 있는 색(black)으로 대신한다.
 */
export function readCssColor(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || 'black';
}

export interface OriginOverlay {
  pin: naver.maps.Marker;
  circle: naver.maps.Circle | null;
  /** 지금 그려 둔 값. 같으면 SDK 를 다시 부르지 않는다. */
  lat: number;
  lng: number;
  radiusKm: number | null;
}

/** 중심 핀의 눈에 보이는 요소. 모양은 자리표시자의 핀과 같고 보이지 않는 이름을 붙인다. */
function buildOriginElement(label: string): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = placeholderStyles.pin ?? '';
  wrap.setAttribute('role', 'img');
  wrap.setAttribute('aria-label', label);
  wrap.appendChild(buildPinSvg());
  return wrap;
}

/**
 * 기준점을 지도에 맞춘다. 핀은 한 번 만들고 좌표가 바뀌면 옮기며, 원은 반경이 바뀌면 반경만 바꾼다.
 * 반경 제한이 없으면(radiusKm === null) 원을 지운다. 지도는 다시 만들지 않는다.
 */
export function syncOrigin(
  map: naver.maps.Map,
  current: OriginOverlay | null,
  origin: GeoOrigin,
): OriginOverlay {
  const position = new naver.maps.LatLng(origin.lat, origin.lng);
  const moved = !current || current.lat !== origin.lat || current.lng !== origin.lng;

  const pin =
    current?.pin ??
    new naver.maps.Marker({
      map,
      position,
      clickable: false,
      icon: {
        content: buildOriginElement(origin.label),
        // 핀 그림의 중심이 좌표에 오게 한다(자리표시자도 원의 중심을 핀 중심에 맞춘다).
        anchor: new naver.maps.Point(PIN_SIZE.width / 2, PIN_SIZE.height / 2),
      },
    });
  if (current && moved) pin.setPosition(position);

  let circle = current?.circle ?? null;
  if (origin.radiusKm === null) {
    circle?.setMap(null);
    circle = null;
  } else if (circle) {
    if (moved) circle.setCenter(position);
    if (current?.radiusKm !== origin.radiusKm) circle.setRadius(origin.radiusKm * 1000);
  } else {
    const color = readCssColor('--color-black');
    circle = new naver.maps.Circle({
      map,
      center: position,
      radius: origin.radiusKm * 1000,
      strokeColor: color,
      strokeOpacity: 1,
      strokeWeight: RING_STROKE_WEIGHT,
      strokeStyle: RING_STROKE_STYLE,
      fillColor: color,
      fillOpacity: RING_FILL_OPACITY,
      clickable: false,
    });
  }
  return { pin, circle, lat: origin.lat, lng: origin.lng, radiusKm: origin.radiusKm };
}

/** 핀과 원을 지도에서 뗀다. */
export function removeOrigin(overlay: OriginOverlay): void {
  overlay.circle?.setMap(null);
  overlay.pin.setMap(null);
}

/**
 * 시점을 맞춘다. animate 이면 지도가 튀지 않게 부드럽게 이동(panToBounds)하고, 아니면 바로 맞춘다(fitBounds).
 * - 반경이 있으면: 원 전체와 마커
 * - 반경 제한이 없고 범위(areaBounds, 예: 기흥구 전체)가 있으면: 그 범위(핀·마커가 범위 밖이면 함께 감싼다)
 * - 반경 제한이 없고 범위도 없으면: 핀과 마커 전체(라벨이 잘리지 않게 여백을 더한다)
 */
export function fitToOrigin(
  map: naver.maps.Map,
  origin: GeoOrigin,
  markers: readonly GeoMarker[],
  animate: boolean,
): void {
  const area = origin.radiusKm === null ? origin.areaBounds : undefined;
  const corners =
    origin.radiusKm !== null
      ? Object.values(circleBounds(origin, origin.radiusKm))
      : area
        ? [area.sw, area.ne]
        : [];
  const points = [
    ...corners,
    { lat: origin.lat, lng: origin.lng },
    ...markers.map((m) => ({ lat: m.lat, lng: m.lng })),
  ];
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const [minLat, maxLat] = [Math.min(...lats), Math.max(...lats)];
  const [minLng, maxLng] = [Math.min(...lngs), Math.max(...lngs)];

  if (minLat === maxLat && minLng === maxLng) {
    // 점 하나뿐(반경 제한 없음 + 범위 없음 + 마커 없음): 고정 줌
    map.setCenter(new naver.maps.LatLng(minLat, minLng));
    map.setZoom(SINGLE_MARKER_ZOOM);
    return;
  }
  const bounds = new naver.maps.LatLngBounds(
    new naver.maps.LatLng(minLat, minLng),
    new naver.maps.LatLng(maxLat, maxLng),
  );
  // 원이나 범위가 있으면 그것이 라벨 영역을 넉넉히 감싼다. 둘 다 없을 때만 라벨 몫의 여백을 더한다.
  const extra = origin.radiusKm === null && !area && markers.length > 0 ? LABEL_EXTRA_MARGIN : null;
  const margin = {
    top: ORIGIN_FIT_MARGIN,
    right: ORIGIN_FIT_MARGIN + (extra?.right ?? 0),
    bottom: ORIGIN_FIT_MARGIN + (extra?.bottom ?? 0),
    left: ORIGIN_FIT_MARGIN,
  };
  if (animate) {
    map.panToBounds(bounds, { duration: PAN_DURATION_MS }, margin);
  } else {
    map.fitBounds(bounds, { ...margin, maxZoom: FIT_MAX_ZOOM });
  }
}
