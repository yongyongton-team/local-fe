import { useId } from 'react';
import type { OwnerOffer } from '@/types/domain';
import { OFFER_COPY } from './copy';
import { buildDetailRows, buildProgress } from './offerView';
import styles from './OfferDetailCard.module.css';

/**
 * 상세의 값 행(가격·받는 날·마감·받는 곳)과 예약 막대 + "N / M명 예약"(Figma 79:2488).
 * 막대 비율은 예약 ÷ 최소 주문(초과하면 가득). 값이 없는 행은 그리지 않는다.
 */
export function OfferDetailCard({ offer }: { offer: OwnerOffer }) {
  const textId = useId();
  const progress = buildProgress(offer);
  const rows = buildDetailRows(offer);

  return (
    <div className={styles.block}>
      {rows.length > 0 && (
        <dl className={styles.rows}>
          {rows.map((row) => (
            <div key={row.key} className={styles.row}>
              <dt className={styles.label}>{row.label}</dt>
              <dd className={styles.value}>{row.value}</dd>
            </div>
          ))}
        </dl>
      )}
      <div
        role="progressbar"
        aria-labelledby={textId}
        aria-valuemin={0}
        aria-valuemax={progress.valueMax}
        aria-valuenow={Math.min(progress.valueNow, progress.valueMax)}
        className={styles.track}
      >
        <div className={styles.fill} style={{ width: `${progress.ratio * 100}%` }} />
      </div>
      <p id={textId} className={styles.reserved}>
        {OFFER_COPY.reserved(offer.orderCount, offer.minOrders)}
      </p>
    </div>
  );
}
