import { ChipFieldset } from './ChipFieldset';
import { REQUEST_CATEGORY_CHOICES } from './constants';
import styles from './SummaryCard.module.css';

interface SummaryCardProps {
  /** 정리된 업종의 표기. 정해지지 않았으면 null */
  categoryLabel: string | null;
  conditions: readonly string[];
  /** true 이면 업종이 정해지지 않아 후보 칩에서 고르게 한다(B 상태). false 이면 인식된 업종을 보여준다(A 상태). */
  needsChoice: boolean;
  chosenCategoryId: string | null;
  onChooseCategory: (categoryId: string) => void;
}

/**
 * AI 가 입력 문장을 정리한 결과 카드. 지금은 키워드 규칙 목이므로 "예시 정리"임을 구석에 표시한다.
 * A: 업종이 하나로 정해져 "업종 / 조건"만 보여준다(업종을 바꾸는 수단은 디자인에 없다).
 * B: 업종 후보 3개 중 하나를 고르며, 고른 업종이 "업종" 값에 반영된다.
 */
export function SummaryCard({
  categoryLabel,
  conditions,
  needsChoice,
  chosenCategoryId,
  onChooseCategory,
}: SummaryCardProps) {
  return (
    <section className={styles.card} aria-label="요청 정리 결과">
      {/* 디자인에 없는 임시 표시. AI 연동 후 제거한다. */}
      <p className={styles.sample}>예시 정리 · AI 연동 예정</p>

      <div className={styles.head}>
        <span className={styles.badge} aria-hidden="true">
          AI
        </span>
        <h2 className={styles.title}>이렇게 정리했어요</h2>
      </div>

      <dl className={styles.rows}>
        <div className={styles.row}>
          <dt>업종</dt>
          <dd>{categoryLabel ?? '선택해 주세요'}</dd>
        </div>
        {conditions.length > 0 && (
          <div className={styles.row}>
            <dt>조건</dt>
            <dd>{conditions.join(' / ')}</dd>
          </div>
        )}
      </dl>

      {needsChoice && (
        <div className={styles.choices}>
          <ChipFieldset
            legend="업종 후보"
            legendHidden
            mode="radio"
            options={REQUEST_CATEGORY_CHOICES}
            value={chosenCategoryId}
            onChange={onChooseCategory}
          />
        </div>
      )}

      <p className={styles.notice}>
        {needsChoice ? '가장 가까운 업종을 선택해 주세요!' : '문장을 바꾸면 다시 정리해요!'}
      </p>
    </section>
  );
}
