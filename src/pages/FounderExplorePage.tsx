import { ReportList } from '@/features/demand/ReportList';
import { paths } from '@/shared/lib/paths';
import { Page } from '@/shared/ui/Page';
import { SampleDataBadge } from '@/shared/ui/SampleDataBadge';
import { Text } from '@/shared/ui/Text';

/** 예비 창업자용 입지 탐색. 요청은 많고 가게는 없는 동네를 요청 많은 순으로 보여준다. */
export function FounderExplorePage() {
  return (
    <Page title="입지 찾기">
      <SampleDataBadge />
      <section aria-labelledby="candidate-areas">
        <Text as="h2" variant="title" id="candidate-areas">
          요청은 많고 가게는 없는 동네
        </Text>
        <ReportList toArea={paths.founderAreaReport} />
      </section>
    </Page>
  );
}
