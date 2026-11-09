import type { MapMarker } from '@/types/domain';
import { buildPinSvg } from './icons';
import placeholderStyles from './MapPlaceholder.module.css';

/*
 * 네이버 지도 마커 동기화. 기존 자리표시자 지도(MapPlaceholder)와 같은 마커 모양을 HTML 아이콘으로 만든다.
 * 스타일은 MapPlaceholder.module.css 의 클래스(= 디자인 토큰·CSS 변수)를 그대로 쓴다.
 */

/** 위도·경도가 있는 마커 */
export type GeoMarker = MapMarker & { lat: number; lng: number };

/** 위도·경도가 모두 유한한 숫자인 마커(NaN·Infinity·undefined 는 지도에 올리지 않는다) */
export const hasCoordinates = (marker: MapMarker): marker is GeoMarker =>
  Number.isFinite(marker.lat) && Number.isFinite(marker.lng);

/** [임의] 알약(요청·부족 가게) 마커의 z-index. 가게 핀(0)보다 위에 둔다. */
const PILL_Z_INDEX = 10;

/** [임의] 마커가 하나뿐일 때의 고정 줌 */
export const SINGLE_MARKER_ZOOM = 16;
/** [임의] 마커 전체가 보이게 맞출 때의 여백(px). 알약이 가장자리에서 잘리지 않게 한다. */
export const FIT_MARGIN = 48;
/** [임의] 마커 전체를 맞출 때 확대하지 않을 한계 줌(마커가 가까이 모여 있을 때) */
export const FIT_MAX_ZOOM = 17;

/** 마커의 눈에 보이는 요소. 모양이 같으면 같은 시그니처다. */
export function buildMarkerElement(marker: MapMarker): HTMLElement {
  const wrap = document.createElement('div');
  if (marker.kind === 'existing') {
    // 글자가 없는 핀. 보이지 않는 이름을 붙인다.
    wrap.className = placeholderStyles.pin ?? '';
    wrap.setAttribute('role', 'img');
    wrap.setAttribute('aria-label', marker.label);
    wrap.appendChild(buildPinSvg());
    return wrap;
  }
  const pill = document.createElement('span');
  pill.className =
    (marker.kind === 'request' ? placeholderStyles.request : placeholderStyles.missing) ?? '';
  pill.textContent = marker.label;
  wrap.appendChild(pill);
  return wrap;
}

const signatureOf = (marker: GeoMarker) =>
  `${marker.kind}|${marker.label}|${marker.lat}|${marker.lng}|${marker.offset?.x ?? 0},${marker.offset?.y ?? 0}`;

export interface MarkerOverlay {
  marker: naver.maps.Marker;
  signature: string;
}

/**
 * 지도 위의 마커를 next 에 맞춘다. 지도를 다시 만들지 않고 바뀐 마커만 더하거나 지운다.
 * 모양이 같은 마커는 그대로 두고, 사라진 마커는 지도에서 떼며, 내용이 바뀐 마커는 다시 만든다.
 */
export function syncMarkers(
  map: naver.maps.Map,
  overlays: Map<string, MarkerOverlay>,
  next: readonly GeoMarker[],
): void {
  const nextIds = new Set(next.map((m) => m.id));
  for (const [id, overlay] of overlays) {
    if (!nextIds.has(id)) {
      overlay.marker.setMap(null);
      overlays.delete(id);
    }
  }
  for (const marker of next) {
    const signature = signatureOf(marker);
    const current = overlays.get(marker.id);
    if (current?.signature === signature) continue;
    current?.marker.setMap(null);
    overlays.set(marker.id, {
      signature,
      marker: new naver.maps.Marker({
        map,
        position: new naver.maps.LatLng(marker.lat, marker.lng),
        clickable: false,
        // 가게 핀이 수백 개인 동네에서도 알약(요청·부족 가게)이 핀에 가려지지 않게 알약을 위에 그린다.
        zIndex: marker.kind === 'existing' ? 0 : PILL_Z_INDEX,
        icon: {
          content: buildMarkerElement(marker),
          // 자리표시자 지도와 같이 요소의 왼쪽 위가 좌표다. 자리표시자에서 겹치지 않게 잡은 배치 관계가
          // 그대로 유지된다(가운데 기준으로 두면 넓은 알약이 옆 마커를 덮는다).
          // offset 이 있으면 라벨을 그만큼 옮겨 그린다(anchor 는 반대 방향).
          // (0 - x 로 쓴다: -(0) 은 -0 이 되어 좌표 비교가 어긋난다)
          anchor: new naver.maps.Point(0 - (marker.offset?.x ?? 0), 0 - (marker.offset?.y ?? 0)),
        },
      }),
    });
  }
}

/** 마커 전체가 보이게 중심·줌을 맞춘다. 하나뿐이면 고정 줌을 쓴다. */
export function fitToMarkers(map: naver.maps.Map, markers: readonly GeoMarker[]): void {
  const [first] = markers;
  if (!first) return;
  if (markers.length === 1) {
    map.setCenter(new naver.maps.LatLng(first.lat, first.lng));
    map.setZoom(SINGLE_MARKER_ZOOM);
    return;
  }
  const lats = markers.map((m) => m.lat);
  const lngs = markers.map((m) => m.lng);
  const bounds = new naver.maps.LatLngBounds(
    new naver.maps.LatLng(Math.min(...lats), Math.min(...lngs)),
    new naver.maps.LatLng(Math.max(...lats), Math.max(...lngs)),
  );
  map.fitBounds(bounds, {
    top: FIT_MARGIN,
    right: FIT_MARGIN,
    bottom: FIT_MARGIN,
    left: FIT_MARGIN,
    maxZoom: FIT_MAX_ZOOM,
  });
}
