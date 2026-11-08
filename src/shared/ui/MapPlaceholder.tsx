import type { CSSProperties } from 'react';
import type { MapMarker, MapOrigin } from '@/types/domain';
import { PinIcon } from './icons';
import styles from './MapPlaceholder.module.css';

interface MapPlaceholderProps {
  /** 지금 보여줄 마커(필터를 적용한 결과). 위치는 지도 영역 대비 상대좌표다. */
  markers?: readonly MapMarker[];
  /**
   * 기준점(내 가게 위치) 핀과 반경. 핀은 보이지 않는 텍스트로 읽히고, 점선 원은 장식이라 숨긴다.
   * 자리표시자는 원 크기를 고정해서 그린다. 반경(km)은 지도 연동 때 실제 반경으로 그리도록 data 로만 남긴다.
   */
  origin?: MapOrigin;
  /** 지도 영역의 접근 가능한 이름 */
  label?: string;
  /** 보이지 않는 aria-live 요약. 필터가 바뀔 때 보조 기술에 알린다. */
  summary?: string;
}

/**
 * 지도 자리표시자. 마커를 지도 영역 위에 비율로 배치한다.
 * 이후 네이버 지도 컴포넌트가 같은 props(markers, label, summary)를 받도록 교체한다.
 * 지도 SDK 선택과 API 연동은 후속 작업이며, 현재 위치 권한은 요청하지 않는다.
 */
export function MapPlaceholder({
  markers = [],
  origin,
  label = '지도 영역',
  summary,
}: MapPlaceholderProps) {
  return (
    <section className={styles.map} aria-label={label}>
      {origin && (
        <>
          <span
            aria-hidden="true"
            className={styles.ring}
            data-radius-km={origin.radiusKm ?? 'none'}
            style={{ '--x': origin.position.x, '--y': origin.position.y } as CSSProperties}
          />
          <span
            className={styles.origin}
            style={{ '--x': origin.position.x, '--y': origin.position.y } as CSSProperties}
          >
            <PinIcon />
            <span className="visually-hidden">{origin.label}</span>
          </span>
        </>
      )}
      <ul className={styles.markers}>
        {markers.map((marker) => (
          <li
            key={marker.id}
            className={styles.marker}
            style={{ '--x': marker.position.x, '--y': marker.position.y } as CSSProperties}
          >
            {marker.kind === 'existing' ? (
              // 글자가 없는 핀. 장식으로 숨기지 않고 보이지 않는 텍스트를 붙인다.
              <span className={styles.pin}>
                <PinIcon />
                <span className="visually-hidden">{marker.label}</span>
              </span>
            ) : (
              <span className={marker.kind === 'request' ? styles.request : styles.missing}>
                {marker.label}
              </span>
            )}
          </li>
        ))}
      </ul>
      {/* 디자인에 없는 임시 표시. 네이버 지도 연동 후 제거한다. */}
      <p className={styles.notice}>지도 연동 예정 · 예시 데이터</p>
      {summary !== undefined && (
        <p className="visually-hidden" aria-live="polite">
          {summary}
        </p>
      )}
    </section>
  );
}
