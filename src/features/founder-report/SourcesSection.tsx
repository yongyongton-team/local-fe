import { useId } from 'react';
import { REPORT_SOURCES, SAMPLE_DATA_NOTICE } from './constants';
import styles from './SourcesSection.module.css';

/**
 * "근거 데이터": 제목(h2)과 출처 목록(ul). 앞의 "· "는 장식이라 글머리표 스타일(CSS)로 처리한다.
 * 목록 아래에, 디자인에 없는 안내로 이 수치가 실제 통계가 아님을 알린다.
 */
export function SourcesSection() {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className={styles.section}>
      <h2 className={styles.heading} id={headingId}>
        근거 데이터
      </h2>
      <div className={styles.card}>
        <ul className={styles.list}>
          {REPORT_SOURCES.map((source) => (
            <li key={source}>{source}</li>
          ))}
        </ul>
        <p className={styles.notice}>{SAMPLE_DATA_NOTICE}</p>
      </div>
    </section>
  );
}
