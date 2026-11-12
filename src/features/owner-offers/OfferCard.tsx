import { useId } from 'react';
import type { OwnerOffer } from '@/types/domain';
import { buildOfferRows, buildProgress, statusLabel } from './offerView';
import styles from './OfferCard.module.css';

/**
 * 제안 한 건(Figma 45:584). 제목과 상태 배지, 가격·받는 날·마감 행, 진행 막대와 "N / M명 예약".
 * 가격·받는 날은 서버가 아직 주지 않을 수 있어 값이 없으면 그 행만 그리지 않는다.
 */
export function OfferCard({ offer }: { offer: OwnerOffer }) {
  const titleId = useId();
  const labelId = useId();
  const rows = buildOfferRows(offer);
  const badge = statusLabel(offer);
  const progress = buildProgress(offer);

  return (
    <article className={styles.card} aria-labelledby={titleId}>
      <div className={styles.head}>
        <h3 id={titleId} className={styles.title}>
          {offer.title}
        </h3>
        {badge && <span className={styles.badge}>{badge}</span>}
      </div>
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
        aria-labelledby={labelId}
        aria-valuemin={0}
        aria-valuemax={progress.valueMax}
        aria-valuenow={progress.valueNow}
        className={styles.track}
      >
        <div className={styles.fill} style={{ width: `${progress.ratio * 100}%` }} />
      </div>
      <p id={labelId} className={styles.reserved}>
        {progress.label}
      </p>
    </article>
  );
}
