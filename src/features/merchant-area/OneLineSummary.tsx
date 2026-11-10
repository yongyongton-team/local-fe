import { useId } from 'react';
import styles from './OneLineSummary.module.css';

/**
 * "한 줄 요약" 카드. 지금은 템플릿 문장이라 구석에 "예시 정리 · AI 연동 예정"을 표시한다.
 * AI 배지는 장식이라 보조 기술에서 숨긴다. summary 가 null 이면 문장 자리에 안내를 보여준다.
 */
export function OneLineSummary({
  summary,
  remote = false,
}: {
  summary: string | null;
  /** true 이면 서버가 쓴 요약이라 "예시 정리" 표시를 숨긴다. */
  remote?: boolean;
}) {
  const headingId = useId();

  return (
    <section className={styles.card} aria-labelledby={headingId}>
      {/* 디자인에 없는 임시 표시. 목 문장일 때만 붙인다(서버가 쓴 요약이면 숨긴다). */}
      {!remote && <p className={styles.sample}>예시 정리 · AI 연동 예정</p>}
      <div className={styles.head}>
        <span className={styles.badge} aria-hidden="true">
          AI
        </span>
        <h2 className={styles.title} id={headingId}>
          한 줄 요약
        </h2>
      </div>
      <p className={styles.text}>{summary ?? '요약을 불러오지 못했어요.'}</p>
    </section>
  );
}
