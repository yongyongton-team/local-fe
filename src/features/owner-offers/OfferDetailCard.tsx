import { useId } from 'react';
import type { OwnerOffer } from '@/types/domain';
import { OFFER_COPY } from './copy';
import { buildDetailRows, buildProgress, buildStatusNote } from './offerView';
import styles from './OfferDetailCard.module.css';

/**
 * 예약 현황 카드(Figma 66:495): "예약 N명 · 최소 M명", 진행 막대, 상태 안내 문구, 받는 날·받는 곳.
 * 막대 비율은 예약 ÷ 최소 주문(초과하면 가득). 받는 날·받는 곳은 값이 없으면 그 행을 그리지 않는다.
 */
export function OfferDetailCard({ offer }: { offer: OwnerOffer }) {
  const titleId = useId();
  const progress = buildProgress(offer);
  const note = buildStatusNote(offer);
  const rows = buildDetailRows(offer);

  return (
    <section className={styles.card} aria-label={OFFER_COPY.detailRegionLabel}>
      <p id={titleId} className={styles.title}>
        {OFFER_COPY.reservedSummary(offer.orderCount, offer.minOrders)}
      </p>
      <div
        role="progressbar"
        aria-labelledby={titleId}
        aria-valuemin={0}
        aria-valuemax={progress.valueMax}
        aria-valuenow={progress.valueNow}
        className={styles.track}
      >
        <div className={styles.fill} style={{ width: `${progress.ratio * 100}%` }} />
      </div>
      {note && <p className={styles.note}>{note}</p>}
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
    </section>
  );
}
