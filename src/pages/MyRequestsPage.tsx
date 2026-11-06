import { paths } from '@/shared/lib/paths';
import { Notice } from '@/shared/ui/Notice';
import { Page } from '@/shared/ui/Page';

/** 내 요청 목록. 요청 저장·조회 기능은 백엔드 연동 후 구현한다. */
export function MyRequestsPage() {
  return (
    <Page title="내 요청">
      <Notice
        title="요청 목록은 준비 중이에요"
        action={{ to: paths.residentRequestNew, label: '가게 요청하기' }}
      >
        내가 보낸 요청과 사장님 응답이 여기에 모일 예정이에요.
      </Notice>
    </Page>
  );
}
