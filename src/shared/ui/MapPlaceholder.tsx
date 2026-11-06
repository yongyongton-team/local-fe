import styles from './MapPlaceholder.module.css';

/**
 * 지도 자리표시자. 지도 SDK 선택과 API 연동은 후속 작업이다.
 * 현재 위치 권한은 요청하지 않는다.
 */
export function MapPlaceholder() {
  return (
    <div className={styles.map}>
      <p className={styles.text}>지도는 후속 작업에서 연결해요</p>
    </div>
  );
}
