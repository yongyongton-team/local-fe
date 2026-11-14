import { useId } from 'react';
import { Link } from 'react-router';
import { paths } from '@/shared/lib/paths';
import type { OwnerOffer } from '@/types/domain';
import { buildOfferRows, buildProgress } from './offerView';
import { OfferStatusBadge } from './OfferStatusBadge';
import styles from './OfferCard.module.css';

/**
 * 제안 한 건(Figma 45:584). 제목과 상태 배지, 가격·받는 날·마감 행, 진행 막대와 "N / M명 예약".
 * 가격·받는 날은 서버가 아직 주지 않을 수 있어 값이 없으면 그 행만 그리지 않는다.
 * 제목이 제안 상세(/merchant/offers/:offerId)로 가는 링크이고, 링크가 카드 전체를 덮어 카드 어디를 눌러도 이동한다.
 */
export function OfferCard({ offer }: { offer: OwnerOffer }) {
  const titleId = useId();
  const labelId = useId();
  const rows = buildOfferRows(offer);
  const progress = buildProgress(offer);

  return (
    <article className={styles.card} aria-labelledby={titleId}>
      <div className={styles.head}>
        <h3 id={titleId} className={styles.title}>
          <Link to={paths.merchantOffer(offer.id)} className={styles.link}>
            {offer.title}
          </Link>
        </h3>
        <OfferStatusBadge offer={offer} />
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
