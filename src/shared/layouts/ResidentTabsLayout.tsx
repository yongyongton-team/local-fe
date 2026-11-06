import { Outlet } from 'react-router';
import { paths } from '@/shared/lib/paths';
import { BottomNav } from '@/shared/ui/BottomNav';
import { MobileLayout } from './MobileLayout';

/*
 * 임시안: Figma 에는 3개 탭(아이콘만, 라벨 없음)이 있으나 세 번째 탭의 의미를 확인하지 못했다.
 * 그래서 요구사항의 임시 구성(탐색·내 요청)만 두고, 주민 화면 /resident, /resident/requests 에만 표시한다.
 */
const RESIDENT_TABS = [
  { to: paths.resident, label: '탐색', end: true },
  { to: paths.residentRequests, label: '내 요청', end: true },
] as const;

/** 주민 화면용 라우트 레이아웃. 하단 내비게이션 슬롯을 채운다. */
export function ResidentTabsLayout() {
  return (
    <MobileLayout bottomNav={<BottomNav label="주민 메뉴" items={RESIDENT_TABS} />}>
      <Outlet />
    </MobileLayout>
  );
}
