import { Outlet } from 'react-router';
import { MyInfoLink } from '@/shared/ui/MyInfoLink';
import { MobileLayout } from './MobileLayout';

/**
 * 사장님·예비 창업자 화면용 라우트 레이아웃: 하단 내비 없이, 우측 상단에 "내 정보" 아이콘(/me)을 둔다.
 * 아이콘은 이 레이아웃 한 곳에서만 그리고 각 화면은 따로 알 필요가 없다.
 * 주민 화면은 하단 내비의 네 번째 항목(ResidentTabsLayout)이 같은 진입점이고, 내 정보(/me)·동네 선택(/me/dong)과
 * 역할이 없는 첫 화면은 이 레이아웃을 쓰지 않는다(RootLayout).
 */
export function RoleLayout() {
  return (
    <MobileLayout corner={<MyInfoLink />}>
      <Outlet />
    </MobileLayout>
  );
}
