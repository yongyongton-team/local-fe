import { Outlet } from 'react-router';
import { MobileLayout } from './MobileLayout';

/** 내비게이션이 없는 기본 라우트 레이아웃. */
export function RootLayout() {
  return (
    <MobileLayout>
      <Outlet />
    </MobileLayout>
  );
}
