import { useId } from 'react';
import { REPORT_SOURCES, SAMPLE_DATA_NOTICE } from './constants';
import styles from './SourcesSection.module.css';

/**
 * "근거 데이터": 제목(h2)과 출처 목록(ul). 앞의 "· "는 장식이라 글머리표 스타일(CSS)로 처리한다.
 * 목록 아래에, 디자인에 없는 안내로 이 수치가 실제 통계가 아님을 알린다.
 */
export function SourcesSection({
  sources,
  remote = false,
}: {
  /** 서버가 준 근거 데이터(API 모드). 없으면 디자인의 기본 출처 목록을 쓴다. */
  sources?: readonly { name: string; asOf?: string }[];
  /** true 이면 서버 데이터라 "개발용 예시 데이터" 안내를 숨긴다. */
  remote?: boolean;
}) {
  const headingId = useId();
  // 서버 근거는 "이름 (기준일)" 로 보여준다. 기준일이 없으면 이름만.
  const lines =
    sources && sources.length > 0
      ? sources.map(({ name, asOf }) => (asOf ? `${name} (${asOf})` : name))
      : REPORT_SOURCES;

  return (
    <section aria-labelledby={headingId} className={styles.section}>
      <h2 className={styles.heading} id={headingId}>
        근거 데이터
      </h2>
      <div className={styles.card}>
        <ul className={styles.list}>
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        {!remote && <p className={styles.notice}>{SAMPLE_DATA_NOTICE}</p>}
      </div>
    </section>
  );
}
