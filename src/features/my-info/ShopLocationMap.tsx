import { useCallback, useEffect, useRef } from 'react';
import type { GeoPoint } from '@/shared/lib/naverGeocode';
import { useNaverMapScript } from '@/shared/lib/useNaverMapScript';
import { PinIcon } from '@/shared/ui/icons';
import styles from './ShopLocationMap.module.css';

/** 주소 검색 결과나 기존 가게 위치를 보여줄 때의 줌(동네 전체보다 가깝게). */
export const SHOP_ZOOM = 16;

interface ShopLocationMapProps {
  /** 지도를 처음 만들 때의 중심과 줌. 이후 바뀌어도 지도를 다시 만들지 않는다. */
  initialCenter: GeoPoint;
  initialZoom: number;
  /** 코드로 지도를 옮길 때(주소 검색 결과). seq 가 바뀔 때마다 그 좌표로 옮긴다. */
  target: { point: GeoPoint; seq: number } | null;
  /** 사용자가 지도를 움직여 멈췄을 때(드래그·확대·축소 뒤) 지도 중심. 이 좌표가 가게 위치가 된다. */
  onUserMove: (center: GeoPoint) => void;
  /** SDK 호출이 예외를 던져 지도를 쓸 수 없을 때 한 번 알린다. */
  onError: () => void;
  label: string;
}

/** LatLng 는 SDK 에서는 lat()·lng() 메서드이고, 값 객체(좌표 리터럴)는 lat·lng 필드다. */
function readCenter(map: naver.maps.Map): GeoPoint {
  const c = map.getCenter() as unknown as {
    lat: number | (() => number);
    lng: number | (() => number);
  };
  return {
    lat: typeof c.lat === 'function' ? c.lat() : c.lat,
    lng: typeof c.lng === 'function' ? c.lng() : c.lng,
  };
}

/** SDK 정리 호출은 실패해도 앱을 멈추지 않는다. */
function safely(action: () => void) {
  try {
    action();
  } catch {
    // 인증 실패 직후에는 SDK 내부 상태가 깨져 예외를 던질 수 있다. 이미 지도가 사라지는 중이다.
  }
}

/**
 * 가게 위치를 고르는 지도. 가운데 핀은 고정이고, 지도를 움직여 핀이 가리키는 곳(= 지도 중심)을 가게 위치로 정한다.
 * 스크립트가 준비되지 않았으면 빈 틀만 그린다(화면이 안내 문구와 저장 비활성을 맡는다). 현재 위치 권한은 요청하지 않는다.
 */
export function ShopLocationMap(props: ShopLocationMapProps) {
  const { status } = useNaverMapScript();
  return (
    <div className={styles.map} role="region" aria-label={props.label}>
      <div className={styles.frame}>{status === 'ready' && <MapCanvas {...props} />}</div>
      {/* 핀은 장식이다. 이름은 지도 영역의 label 이 전달한다. */}
      <span className={styles.pin} aria-hidden="true">
        <PinIcon />
      </span>
    </div>
  );
}

function MapCanvas({
  initialCenter,
  initialZoom,
  target,
  onUserMove,
  onError,
}: ShopLocationMapProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<naver.maps.Map | null>(null);
  // 지도는 한 번만 만든다. 처음 값과 최신 콜백은 ref 로 읽는다.
  const initialRef = useRef({ center: initialCenter, zoom: initialZoom });
  const callbacksRef = useRef({ onUserMove, onError });
  useEffect(() => {
    callbacksRef.current = { onUserMove, onError };
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { center, zoom } = initialRef.current;
    let map: naver.maps.Map;
    try {
      map = new naver.maps.Map(canvas, {
        center: new naver.maps.LatLng(center.lat, center.lng),
        zoom,
        // 디자인에 없는 컨트롤은 끈다. 드래그와 두 손가락 확대·축소는 그대로 쓴다.
        zoomControl: false,
        scaleControl: false,
        mapDataControl: false,
        mapTypeControl: false,
      });
    } catch {
      callbacksRef.current.onError();
      return;
    }
    mapRef.current = map;

    // 사용자가 움직이기 시작했다는 표시. 코드로 옮긴 경우(주소 검색)는 화면이 이미 그 좌표를 알고 있다.
    let moving = false;
    const markMoving = () => {
      moving = true;
    };
    const listeners = [
      naver.maps.Event.addListener(map, 'dragstart', markMoving),
      naver.maps.Event.addListener(map, 'pinchstart', markMoving),
      naver.maps.Event.addListener(map, 'zoom_changed', markMoving),
      naver.maps.Event.addListener(map, 'idle', () => {
        if (!moving) return;
        moving = false;
        callbacksRef.current.onUserMove(readCenter(map));
      }),
    ];

    const observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => safely(() => map.autoResize()));
    observer?.observe(canvas);

    return () => {
      observer?.disconnect();
      safely(() => naver.maps.Event.removeListener(listeners));
      safely(() => map.destroy());
      mapRef.current = null;
    };
  }, []);

  // 코드로 옮기기(주소 검색 결과): seq 가 바뀔 때만.
  const seq = target?.seq;
  const targetPoint = target?.point;
  const moveTo = useCallback((point: GeoPoint) => {
    const map = mapRef.current;
    if (!map) return;
    safely(() => {
      map.setCenter(new naver.maps.LatLng(point.lat, point.lng));
      map.setZoom(SHOP_ZOOM);
    });
  }, []);
  useEffect(() => {
    if (seq !== undefined && targetPoint) moveTo(targetPoint);
  }, [seq, targetPoint, moveTo]);

  return <div ref={canvasRef} className={styles.canvas} />;
}
