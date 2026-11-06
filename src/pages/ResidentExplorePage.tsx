import { useState } from 'react';
import { DemandCard } from '@/features/demand/DemandCard';
import { useReport } from '@/features/demand/useReports';
import { NeighborhoodNotice } from '@/features/selection/NeighborhoodNotice';
import { useSelection } from '@/features/selection/SelectionContext';
import { paths } from '@/shared/lib/paths';
import type { AsyncState } from '@/shared/lib/useAsyncData';
import { LinkButton } from '@/shared/ui/Button';
import { ChipGroup } from '@/shared/ui/ChipGroup';
import { MapPlaceholder } from '@/shared/ui/MapPlaceholder';
import { Notice } from '@/shared/ui/Notice';
import { Page } from '@/shared/ui/Page';
import { SampleDataBadge } from '@/shared/ui/SampleDataBadge';
import { Text } from '@/shared/ui/Text';
import type { NeighborhoodReport } from '@/types/domain';

// Figma 에서 확인한 지도 필터 상태. 필터가 목록에 미치는 동작은 후속 작업이다.
const MAP_FILTERS = [
  { value: 'all', label: '전체' },
  { value: 'missing', label: '없는 가게' },
  { value: 'requested', label: '주민 요청' },
  { value: 'existing', label: '있는 가게' },
] as const;

type MapFilter = (typeof MAP_FILTERS)[number]['value'];

/** 주민용 동네 탐색. 지도 영역과 수요 목록을 한 화면에 둔다. */
export function ResidentExplorePage() {
  const { neighborhood } = useSelection();

  return (
    <Page title="동네 탐색">
      {neighborhood ? (
        <ExploreContent
          neighborhoodId={neighborhood.id}
          label={`${neighborhood.district} ${neighborhood.name}`}
        />
      ) : (
        <NeighborhoodNotice />
      )}
    </Page>
  );
}

function ExploreContent({ neighborhoodId, label }: { neighborhoodId: string; label: string }) {
  const [filter, setFilter] = useState<MapFilter>('all');
  const report = useReport(neighborhoodId);

  return (
    <>
      <p>{label}</p>
      <SampleDataBadge />
      <ChipGroup label="지도 필터" options={MAP_FILTERS} value={filter} onChange={setFilter} />
      <MapPlaceholder />
      <section aria-labelledby="missing-stores">
        <Text as="h2" variant="title" id="missing-stores">
          우리 동네에 없는 가게
        </Text>
        <ReportSection state={report} />
      </section>
      <LinkButton to={paths.residentRequestNew} fullWidth>
        가게 요청하기
      </LinkButton>
    </>
  );
}

function ReportSection({ state }: { state: AsyncState<NeighborhoodReport | null> }) {
  if (state.status === 'loading') return <p role="status">불러오는 중이에요.</p>;
  if (state.status === 'error') {
    return <Notice title="데이터를 가져오지 못했어요">잠시 후 다시 시도해 주세요.</Notice>;
  }
  return state.data ? (
    <DemandCard title={`${state.data.category.name} 가게`} report={state.data} />
  ) : (
    <Notice title="이 동네의 데이터가 아직 없어요" />
  );
}
