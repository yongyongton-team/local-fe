import { Outlet } from 'react-router';
import { paths } from '@/shared/lib/paths';
import { BottomNav } from '@/shared/ui/BottomNav';
import { LinkPlusIcon, MapIcon, PersonShieldIcon } from '@/shared/ui/icons';
import { MobileLayout } from './MobileLayout';

/*
 * 하단 내비는 이름 없는 아이콘 3개다(Figma). 아이콘과 경로의 매핑은 모두 확정이다.
 *   지도 아이콘 → 탐색(/resident), 링크+ 아이콘 → 가게 요청(/resident/requests/new),
 *   사람+방패 아이콘 → 내 요청(/resident/requests)
 * 표시 범위: 주민 화면 /resident, /resident/requests/new, /resident/requests 에 보이고
 * 첫 화면·상세·리포트에서는 숨긴다.
 */
const RESIDENT_TABS = [
  {
    to: paths.resident,
    label: '탐색',
    end: true,
    icon: (active: boolean) => <MapIcon active={active} />,
  },
  {
    to: paths.residentRequestNew,
    label: '가게 요청',
    icon: (active: boolean) => <LinkPlusIcon active={active} />,
  },
  {
    to: paths.residentRequests,
    label: '내 요청',
    end: true,
    icon: (active: boolean) => <PersonShieldIcon active={active} />,
  },
] as const;

/** 주민 화면용 라우트 레이아웃. 하단 내비게이션 슬롯을 채운다. */
export function ResidentTabsLayout() {
  return (
    <MobileLayout bottomNav={<BottomNav label="주민 메뉴" items={RESIDENT_TABS} />}>
      <Outlet />
    </MobileLayout>
  );
}
