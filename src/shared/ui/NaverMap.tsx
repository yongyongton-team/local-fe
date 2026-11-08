import { useCallback, useEffect, useRef, useState } from 'react';
import { useNaverMapScript } from '@/shared/lib/useNaverMapScript';
import { MapPlaceholder, type MapPlaceholderProps } from './MapPlaceholder';
import {
  fitToMarkers,
  hasCoordinates,
  syncMarkers,
  type GeoMarker,
  type MarkerOverlay,
} from './naverMapMarkers';
import styles from './NaverMap.module.css';

/** [임의] 마커가 없을 때의 지도 중심(용인시 기흥구 부근)과 줌 */
const DEFAULT_CENTER = { lat: 37.3, lng: 127.115 };
const DEFAULT_ZOOM = 14;

/** 폴백 문구: 키가 있는데 불러오지 못했거나 인증에 실패했을 때만 보인다. */
const FALLBACK_NOTICE = '지도를 불러오지 못했어요';

export interface NaverMapProps extends MapPlaceholderProps {
  /**
   * true 이면 마커 집합(id)이 바뀔 때마다 마커 전체가 보이게 다시 맞춘다(예: 업종에 따라 마커가 달라지는 창업자 화면).
   * 기본(false)은 처음 마커가 생길 때 한 번만 맞추고 이후(예: 칩 필터)에는 지도를 움직이지 않는다.
   */
  refitOnChange?: boolean;
}

/**
 * 네이버 지도. MapPlaceholder 와 같은 props(markers, label, summary)를 받는다.
 * 아래 경우에는 MapPlaceholder 를 폴백으로 보여준다.
 *  - 스크립트가 아직 준비되지 않았다(불러오는 중 포함)
 *  - 키가 없다: 문구 없이 기존 자리표시자 그대로(개발 환경), 테스트 환경도 키가 없어 여기에 해당한다
 *  - 스크립트 로드 실패 또는 인증 실패: "지도를 불러오지 못했어요" 문구와 함께
 *  - origin(기준 핀·반경)이 있다: 아직 실제 지도에서 그리지 않는다(사장님 지도는 후속 작업)
 *  - 마커는 있지만 위도·경도가 하나도 없다
 *  - SDK 호출이 예외를 던졌다(예: 인증 실패 직후 SDK 내부 상태가 깨진 경우). 앱 전체가 멈추지 않게 폴백으로 바꾼다.
 */
export function NaverMap({ refitOnChange = false, ...props }: NaverMapProps) {
  const { status, reason } = useNaverMapScript();
  const [crashed, setCrashed] = useState(false);
  // 참조가 바뀌면 지도를 다시 만들게 되므로 안정적인 콜백으로 둔다.
  const handleError = useCallback(() => setCrashed(true), []);
  const { markers = [], origin, label = '지도 영역', summary } = props;

  const geoMarkers = markers.filter(hasCoordinates);
  const unsupported = origin !== undefined || (markers.length > 0 && geoMarkers.length === 0);

  if (status !== 'ready' || unsupported || crashed) {
    const failed = crashed || (status === 'error' && reason !== 'no-key');
    return <MapPlaceholder {...props} notice={failed ? FALLBACK_NOTICE : undefined} />;
  }
  return (
    <MapCanvas
      markers={geoMarkers}
      label={label}
      summary={summary}
      refitOnChange={refitOnChange}
      onError={handleError}
    />
  );
}

interface MapCanvasProps {
  markers: readonly GeoMarker[];
  label: string;
  summary?: string;
  refitOnChange: boolean;
  /** SDK 호출이 예외를 던졌을 때(지도를 더는 쓸 수 없을 때) 한 번 알린다. */
  onError: () => void;
}

/** SDK 정리 호출은 실패해도 앱을 멈추지 않는다. 인증 실패 직후에는 SDK 내부 상태가 깨져 예외를 던질 수 있다. */
function safely(action: () => void) {
  try {
    action();
  } catch {
    // 정리 중의 SDK 예외는 무시한다. 이미 폴백으로 바뀌는 중이거나 지도가 사라진 상태다.
  }
}

function MapCanvas({ markers, label, summary, refitOnChange, onError }: MapCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<naver.maps.Map | null>(null);
  const overlaysRef = useRef(new Map<string, MarkerOverlay>());
  // 마지막으로 맞춘 마커 집합의 식별자(마커 id 목록). 아직 맞추지 않았으면 null.
  const fittedKeyRef = useRef<string | null>(null);

  // 지도 인스턴스는 마운트할 때 한 번만 만들고, 언마운트(또는 StrictMode 의 재실행)에서 마커까지 정리한다.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const overlays = overlaysRef.current;
    let map: naver.maps.Map;
    try {
      map = new naver.maps.Map(canvas, {
        center: new naver.maps.LatLng(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng),
        zoom: DEFAULT_ZOOM,
        // 디자인에 없는 컨트롤은 끈다. 두 손가락 확대·축소와 드래그는 그대로 쓸 수 있다.
        zoomControl: false,
        scaleControl: false,
        mapDataControl: false,
        mapTypeControl: false,
      });
    } catch {
      onError();
      return;
    }
    mapRef.current = map;

    // 컨테이너 크기가 나중에 바뀌면(회전, 레이아웃 변화, 처음 레이아웃 전에 만든 경우) 지도가 크기를 다시 계산하게 한다.
    const observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => safely(() => map.autoResize()));
    observer?.observe(canvas);

    return () => {
      observer?.disconnect();
      overlays.forEach(({ marker }) => safely(() => marker.setMap(null)));
      overlays.clear();
      safely(() => map.destroy());
      mapRef.current = null;
      fittedKeyRef.current = null;
    };
  }, [onError]);

  // 마커가 바뀌면(칩 필터 등) 지도를 다시 만들지 않고 마커만 갱신한다.
  // 처음 마커가 생길 때 전체가 보이게 맞춘다. 이후에는 refitOnChange 일 때만, 마커 집합(id)이 바뀐 경우에 다시 맞춘다.
  // 라벨·좌표만 바뀐 경우(요청 인원 변화 등)와 refitOnChange 가 아닌 화면의 필터 변경에는 지도를 움직이지 않는다.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    try {
      syncMarkers(map, overlaysRef.current, markers);
      const key = markers
        .map((m) => m.id)
        .sort()
        .join('|');
      const shouldFit =
        markers.length > 0 &&
        (fittedKeyRef.current === null || (refitOnChange && fittedKeyRef.current !== key));
      if (shouldFit) {
        fitToMarkers(map, markers);
        fittedKeyRef.current = key;
      }
    } catch {
      onError();
    }
  }, [markers, refitOnChange, onError]);

  return (
    // 마커는 키보드 탐색 대상이 아니다. 같은 정보가 지도 아래 목록·요약(aria-live)에 있다.
    <div role="region" aria-label={label} className={styles.map}>
      {/* 틀(.frame)이 크기를 정하고 SDK 가 쓰는 컨테이너(.canvas)는 그 안을 채운다. 이유는 NaverMap.module.css 참고. */}
      <div className={styles.frame}>
        <div ref={canvasRef} className={styles.canvas} />
      </div>
      {summary !== undefined && (
        <p className="visually-hidden" aria-live="polite">
          {summary}
        </p>
      )}
    </div>
  );
}
