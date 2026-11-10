import { useId } from 'react';
import type { MyRequest } from '@/types/domain';
import { REQUEST_GOAL_COUNT } from './constants';
import { describeRequestSummary, getProgress } from './requestProgress';
import styles from './ProgressSummaryCard.module.css';

/**
 * 가장 최근에 보낸 요청의 진행 상황 카드. (추정)
 * 디자인에 있던 진행 영역의 빨간 점선 테두리와 카드 하단의 "가장 가까운 업종을 선택해 주세요!"는
 * 의도 확인이 필요해 구현하지 않았다.
 */
export function ProgressSummaryCard({ item }: { item: MyRequest }) {
  const titleId = useId();
  const labelId = useId();
  const progress = getProgress(item.requestCount);

  return (
    <section className={styles.card} aria-labelledby={titleId}>
      <h2 id={titleId} className={styles.title}>
        요청했어요!
      </h2>
      <p className={styles.description}>{describeRequestSummary(item)}</p>

      <div className={styles.progress}>
        <div className={styles.status}>
          {/* 색뿐 아니라 텍스트로도 전달한다. 표시 조건(기준 인원 도달)은 임시 규칙이다. */}
          {progress.reached && <span className={styles.pill}>결정 필요</span>}
          <p id={labelId} className={styles.count}>
            {progress.label}
          </p>
        </div>
        <div
          role="progressbar"
          aria-labelledby={labelId}
          aria-valuemin={0}
          aria-valuemax={REQUEST_GOAL_COUNT}
          aria-valuenow={progress.valueNow}
          aria-valuetext={progress.valueText}
          className={styles.track}
        >
          <div className={styles.fill} style={{ width: `${progress.ratio * 100}%` }} />
        </div>
        <p className={styles.goal}>{REQUEST_GOAL_COUNT}명이 모이면 근처 가게에 알려요</p>
      </div>
    </section>
  );
}
