import { useId } from 'react';
import type { AsyncState } from '@/shared/lib/useAsyncData';
import styles from './WhyCard.module.css';

/**
 * "왜 이 동네인가요?" 카드. 문장은 지금 템플릿이라 "예시 문장 · AI 연동 예정"을 함께 표시한다.
 * AI 배지는 장식이라 보조 기술에서 숨기고, 문장은 aria-live 로 바뀔 때 알린다(만드는 중 → 완성/실패).
 */
export function WhyCard({
  sentence,
  remote = false,
  by,
}: {
  sentence: AsyncState<string>;
  /** true 이면 서버가 쓴 문장이라 "예시 문장" 표시를 숨긴다. */
  remote?: boolean;
  /** 서버가 준 문장의 출처. "AI" 가 아니면(예: TEMPLATE) "문장만 AI가 써요" 안내를 바꾼다. */
  by?: string;
}) {
  const headingId = useId();
  const text =
    sentence.status === 'success'
      ? sentence.data
      : sentence.status === 'loading'
        ? '문장을 정리하는 중이에요.'
        : '문장을 불러오지 못했어요.';

  return (
    <section className={styles.card} aria-labelledby={headingId}>
      <div className={styles.head}>
        <span className={styles.badge} aria-hidden="true">
          AI
        </span>
        <h2 className={styles.title} id={headingId}>
          왜 이 동네인가요?
        </h2>
        {/* 디자인에 없는 임시 표시. 목 문장일 때만 붙인다(서버가 쓴 문장이면 숨긴다). */}
        {!remote && <p className={styles.sample}>예시 문장 · AI 연동 예정</p>}
      </div>
      <p className={styles.text} aria-live="polite">
        {text}
      </p>
      <p className={styles.notice}>
        {remote && by !== undefined && by !== 'AI'
          ? '숫자와 문장 모두 서버가 만들어요'
          : '숫자는 서버가 계산하고, 문장만 AI가 써요'}
      </p>
    </section>
  );
}
