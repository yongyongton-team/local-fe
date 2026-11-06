import { Notice } from '@/shared/ui/Notice';
import { DemandCard } from './DemandCard';
import { useReports } from './useReports';
import styles from './ReportList.module.css';

/** 동네별 리포트를 요청 많은 순 목록으로 보여준다. 각 항목은 상세 경로로 연결된다. */
export function ReportList({ toArea }: { toArea: (areaId: string) => string }) {
  const state = useReports();

  if (state.status === 'loading') return <p role="status">불러오는 중이에요.</p>;
  if (state.status === 'error') {
    return <Notice title="데이터를 가져오지 못했어요">잠시 후 다시 시도해 주세요.</Notice>;
  }
  if (state.data.length === 0) {
    return <Notice title="아직 보여줄 동네가 없어요" />;
  }

  return (
    <ol className={styles.list}>
      {state.data.map((report) => (
        <li key={report.neighborhood.id}>
          <DemandCard
            title={`${report.neighborhood.name}`}
            report={report}
            to={toArea(report.neighborhood.id)}
          />
        </li>
      ))}
    </ol>
  );
}
