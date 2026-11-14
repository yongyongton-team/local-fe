import type { OwnerOffer } from '@/types/domain';
import { statusLabel } from './offerView';
import styles from './OfferStatusBadge.module.css';

/**
 * 제안 상태 배지(Figma WF/배지-상태). 상태를 모르면 아무것도 그리지 않는다.
 * 색은 디자인에서 상태별로 정한다고 해서 지금은 한 가지 모양(옅은 회색 알약)이다.
 */
export function OfferStatusBadge({ offer }: { offer: Pick<OwnerOffer, 'status'> }) {
  const label = statusLabel(offer);
  return label ? <span className={styles.badge}>{label}</span> : null;
}
