import styles from './SummaryStats.module.css';

interface SummaryStatsProps {
  requestCount: number;
  nearbySameCategoryCount: number;
}

/** 요약 카드 둘: 요청한 주민 / 근처 같은 업종. 이름(dt)과 값(dd)의 쌍이다. */
export function SummaryStats({ requestCount, nearbySameCategoryCount }: SummaryStatsProps) {
  return (
    <dl className={styles.stats}>
      <div className={styles.card}>
        <dt className={styles.label}>요청한 주민</dt>
        <dd className={styles.value}>{requestCount}명</dd>
      </div>
      <div className={styles.card}>
        <dt className={styles.label}>근처 같은 업종</dt>
        <dd className={styles.value}>{nearbySameCategoryCount}곳</dd>
      </div>
    </dl>
  );
}
