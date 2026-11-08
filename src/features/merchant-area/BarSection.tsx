import { useId } from 'react';
import { Text } from '@/shared/ui/Text';
import type { BarRowData } from './areaDetailView';
import styles from './BarSection.module.css';

interface BarSectionProps {
  title: string;
  rows: readonly BarRowData[];
}

/**
 * 제목 + 막대 행 목록. 막대는 시각 보조라 보조 기술에서 숨기고, 이름과 값은 텍스트로 읽는다.
 * 읽기 예: "늦게까지 영업, 17명"
 */
export function BarSection({ title, rows }: BarSectionProps) {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className={styles.section}>
      <Text as="h2" variant="contents" id={headingId}>
        {title}
      </Text>
      <ul className={styles.list}>
        {rows.map((row) => (
          <li key={row.key} className={styles.row}>
            <span className={styles.label}>{row.label}</span>
            <span className={styles.track} aria-hidden="true">
              <span
                className={styles.fill}
                data-fill={row.fill}
                style={{ width: `${row.fill * 100}%` }}
              />
            </span>
            <span className={styles.value}>
              <span className="visually-hidden">, </span>
              {row.valueText}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
