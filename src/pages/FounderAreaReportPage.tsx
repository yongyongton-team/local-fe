import { useParams } from 'react-router';
import { DemandFigures } from '@/features/demand/DemandFigures';
import { ReportLoader } from '@/features/demand/ReportLoader';
import { paths } from '@/shared/lib/paths';
import { Notice } from '@/shared/ui/Notice';
import { Page } from '@/shared/ui/Page';
import { SampleDataBadge } from '@/shared/ui/SampleDataBadge';

/** 예비 창업자용 동네 리포트. 수치는 데이터 기준이고, 설명 문장은 아직 제공하지 않는다. */
export function FounderAreaReportPage() {
  const { areaId } = useParams();

  return (
    <ReportLoader areaId={areaId} backTo={paths.founder}>
      {(report) => (
        <Page title={`${report.neighborhood.name} 리포트`} backTo={paths.founder}>
          <SampleDataBadge />
          <DemandFigures demand={report.demand} />
          <Notice title="설명은 준비 중이에요">
            수치를 바탕으로 한 설명 문장은 후속 작업에서 제공해요.
          </Notice>
        </Page>
      )}
    </ReportLoader>
  );
}
