import type { ReactNode } from 'react';
import { paths } from '@/shared/lib/paths';
import { Notice } from '@/shared/ui/Notice';
import { Page } from '@/shared/ui/Page';
import type { NeighborhoodReport } from '@/types/domain';
import { useReport } from './useReports';

interface ReportLoaderProps {
  areaId: string | undefined;
  /** 오류·찾을 수 없음 화면의 뒤로 가기 대상 */
  backTo: string;
  children: (report: NeighborhoodReport) => ReactNode;
}

/** areaId 의 리포트를 불러와 로딩·오류·찾을 수 없음 상태를 페이지 안에서 처리한다. */
export function ReportLoader({ areaId, backTo, children }: ReportLoaderProps) {
  const state = useReport(areaId);

  if (state.status === 'loading') {
    return (
      <Page title="불러오는 중" backTo={backTo}>
        <p role="status">잠시만 기다려 주세요.</p>
      </Page>
    );
  }
  if (state.status === 'error') {
    return (
      <Page title="불러오지 못했어요" backTo={backTo}>
        <Notice title="데이터를 가져오지 못했어요">잠시 후 다시 시도해 주세요.</Notice>
      </Page>
    );
  }
  if (!state.data) {
    return (
      <Page title="찾을 수 없음" backTo={backTo}>
        <Notice title="찾을 수 없는 동네예요" action={{ to: paths.home, label: '첫 화면으로' }}>
          주소가 잘못되었거나 아직 데이터가 없는 동네예요.
        </Notice>
      </Page>
    );
  }
  return <>{children(state.data)}</>;
}
