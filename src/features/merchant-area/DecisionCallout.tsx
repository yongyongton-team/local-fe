import { useId } from 'react';
import { Button } from '@/shared/ui/Button';
import styles from './DecisionCallout.module.css';

/**
 * 하단 "결정 필요" 영역: 빨간 점선 윤곽 안에 알약과 "방문 판매 제안하기" 버튼.
 * 다음 화면의 동작이 정해지지 않아 버튼은 렌더링만 하고 핸들러가 없다.
 * 알약은 버튼의 설명(aria-describedby)이라 "방문 판매 제안하기, 결정 필요" 로 읽힌다.
 */
export function DecisionCallout() {
  const pillId = useId();

  return (
    <div className={styles.callout}>
      <p className={styles.pill} id={pillId}>
        결정 필요
      </p>
      <Button variant="highlight" size="large" fullWidth aria-describedby={pillId}>
        방문 판매 제안하기
      </Button>
    </div>
  );
}
