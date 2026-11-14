import { CheckIcon } from '@/shared/ui/icons';
import { OFFER_COPY } from './copy';
import styles from './OfferSentBanner.module.css';

/** 제안을 보낸 직후에만 상세 맨 위에 보이는 큰 라임 배너(Figma 79:2354): 체크 아이콘 + "제안을 보냈어요!" */
export function OfferSentBanner() {
  return (
    <div role="status" className={styles.banner}>
      <span className={styles.icon} aria-hidden="true">
        <CheckIcon />
      </span>
      <p className={styles.text}>{OFFER_COPY.sentBanner}</p>
    </div>
  );
}

/**
 * 제안을 보낸 직후의 "모집 현황"(Figma 79:2354): 막대는 가득 채우고 알린 주민 수를 보인다.
 * 서버가 알린 주민 수를 주지 않았으면 이 영역을 그리지 않는다(만들어 넣지 않는다).
 */
export function NotifiedResidents({ count }: { count: number }) {
  return (
    <section className={styles.recruit} aria-labelledby="notified-title">
      <h3 id="notified-title" className={styles.recruitTitle}>
        {OFFER_COPY.recruitTitle}
      </h3>
      <div className={styles.recruitBar} aria-hidden="true" />
      <p className={styles.recruitText}>{OFFER_COPY.notifiedResidents(count)}</p>
    </section>
  );
}
