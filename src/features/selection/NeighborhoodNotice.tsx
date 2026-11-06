import { paths } from '@/shared/lib/paths';
import { Notice } from '@/shared/ui/Notice';

/** 동네가 선택되지 않은 채 직접 진입했을 때의 안내. 접근을 막지 않고 첫 화면 링크만 제공한다. */
export function NeighborhoodNotice() {
  return (
    <Notice title="내 동네를 먼저 선택해 주세요" action={{ to: paths.home, label: '첫 화면으로' }}>
      첫 화면에서 역할과 동네를 고르면 이 화면에서 이어서 볼 수 있어요.
    </Notice>
  );
}
