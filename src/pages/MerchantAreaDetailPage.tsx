import { useParams } from 'react-router';
import { DemandFigures } from '@/features/demand/DemandFigures';
import { ReportLoader } from '@/features/demand/ReportLoader';
import { paths } from '@/shared/lib/paths';
import { Page } from '@/shared/ui/Page';
import { SampleDataBadge } from '@/shared/ui/SampleDataBadge';

/** 사장님용 동네 수요 상세. :areaId 는 Neighborhood 의 id 다. */
export function MerchantAreaDetailPage() {
  const { areaId } = useParams();

  return (
    <ReportLoader areaId={areaId} backTo={paths.merchant}>
      {(report) => (
        <Page title={`${report.neighborhood.name} 수요`} backTo={paths.merchant}>
          <SampleDataBadge />
          <p>
            {report.neighborhood.name}에서 {report.category.name} 가게를 원하는 주민 수요예요.
          </p>
          <DemandFigures demand={report.demand} />
        </Page>
      )}
    </ReportLoader>
  );
}
