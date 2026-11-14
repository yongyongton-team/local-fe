import type { OwnerOffer } from '@/types/domain';
import { buildStatusCard } from './offerView';
import styles from './OfferStatusCard.module.css';

/**
 * 상태 카드(Figma 79:2488·79:2449의 연한 라임 카드): "현재 N명 / 최소 M명"과 상태 안내. 모집 중·확정에서만 그린다.
 */
export function OfferStatusCard({ offer }: { offer: OwnerOffer }) {
  const card = buildStatusCard(offer);
  if (!card) return null;
  return (
    <section className={styles.card} aria-label={card.title}>
      <p className={styles.title}>{card.title}</p>
      <p className={styles.note}>{card.note}</p>
    </section>
  );
}
