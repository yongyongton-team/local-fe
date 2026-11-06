import { paths } from '@/shared/lib/paths';
import { Notice } from '@/shared/ui/Notice';
import { Page } from '@/shared/ui/Page';

export function NotFoundPage() {
  return (
    <Page title="찾을 수 없음">
      <Notice title="페이지를 찾을 수 없어요" action={{ to: paths.home, label: '첫 화면으로' }}>
        주소를 다시 확인해 주세요.
      </Notice>
    </Page>
  );
}
