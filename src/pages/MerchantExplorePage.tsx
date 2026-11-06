import { useState } from 'react';
import { ReportList } from '@/features/demand/ReportList';
import { paths } from '@/shared/lib/paths';
import { ChipGroup } from '@/shared/ui/ChipGroup';
import { MapPlaceholder } from '@/shared/ui/MapPlaceholder';
import { Page } from '@/shared/ui/Page';
import { SampleDataBadge } from '@/shared/ui/SampleDataBadge';
import { Text } from '@/shared/ui/Text';

// Figma 에서 확인한 탐색 범위 상태. 범위가 목록에 미치는 동작은 후속 작업이다.
const RADIUS_OPTIONS = [
  { value: '3km', label: '3km 안' },
  { value: '5km', label: '5km 안' },
  { value: 'all', label: '기흥구 전체' },
] as const;

type Radius = (typeof RADIUS_OPTIONS)[number]['value'];

/** 사장님용 수요 동네 탐색. 내 업종을 원하는 동네를 요청 많은 순으로 보여준다. */
export function MerchantExplorePage() {
  const [radius, setRadius] = useState<Radius>('3km');

  return (
    <Page title="수요 동네 탐색">
      <SampleDataBadge />
      <ChipGroup label="탐색 범위" options={RADIUS_OPTIONS} value={radius} onChange={setRadius} />
      <MapPlaceholder />
      <section aria-labelledby="demand-areas">
        <Text as="h2" variant="title" id="demand-areas">
          내 업종을 원하는 동네 · 요청 많은 순
        </Text>
        <ReportList toArea={paths.merchantArea} />
      </section>
    </Page>
  );
}
