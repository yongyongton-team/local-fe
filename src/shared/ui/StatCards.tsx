import styles from './StatCards.module.css';

export interface StatItem {
  /** 카드의 이름. 예: 요청한 주민 */
  label: string;
  /** 카드의 값. 예: 29명 */
  value: string;
}

/**
 * 요약 카드 목록(2열). 카드마다 이름(dt)과 값(dd)이 한 묶음이다.
 * 두 카드씩 한 줄(dl)로 묶어, 한쪽 라벨이 줄바꿈돼도 같은 줄 카드의 값 높이가 같다.
 * 라벨 글자 크기는 부모에서 --stat-label-size, 오른쪽 안쪽 여백은 --stat-pad-right 로 바꾼다(기본 14px, 34px).
 */
export function StatCards({ items }: { items: readonly StatItem[] }) {
  const rows: StatItem[][] = [];
  for (let i = 0; i < items.length; i += 2) rows.push(items.slice(i, i + 2));

  return (
    <div className={styles.rows}>
      {rows.map((row) => (
        <dl key={row.map((item) => item.label).join('|')} className={styles.stats}>
          {row.map((item) => (
            <div key={item.label} className={styles.card}>
              <dt className={styles.label}>{item.label}</dt>
              <dd className={styles.value}>{item.value}</dd>
            </div>
          ))}
        </dl>
      ))}
    </div>
  );
}
