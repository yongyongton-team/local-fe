import type { AreaDetail } from '@/types/domain';
import { buildSummaryText } from './offerView';
import styles from './OfferSummaryCard.module.css';

/** 내 가게·제안 작성 화면 위쪽의 요약 카드(Figma 45:601). "{동} · {업종} 가게" 와 "요청 N명 · 조건". */
export function OfferSummaryCard({ detail }: { detail: AreaDetail }) {
  const { title, line } = buildSummaryText(detail);
  return (
    <section className={styles.card} aria-label="내 가게 요약">
      <p className={styles.title}>{title}</p>
      <p className={styles.line}>{line}</p>
    </section>
  );
}
