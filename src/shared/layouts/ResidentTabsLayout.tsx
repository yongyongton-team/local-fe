import { Outlet } from 'react-router';
import { paths } from '@/shared/lib/paths';
import { BottomNav } from '@/shared/ui/BottomNav';
import { LinkPlusIcon, MapIcon, PersonShieldIcon, StoreSignIcon } from '@/shared/ui/icons';
import { MobileLayout } from './MobileLayout';

/*
 * 하단 내비는 이름 없는 아이콘이다(Figma 3개 + 내 정보 1개). 아이콘과 경로의 매핑은 모두 확정이다.
 *   지도 아이콘 → 탐색(/resident), 링크+ 아이콘 → 가게 요청(/resident/requests/new),
 *   사람+방패 아이콘 → 내 요청(/resident/requests), 가게 간판(storefront) 아이콘 → 내 정보(/me)
 * 네 번째(내 정보)는 내비가 없는 /me 로 나가므로 이 레이아웃 안에서는 현재 항목이 되지 않는다.
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
  {
    to: paths.me,
    label: '내 정보',
    end: true,
    icon: () => <StoreSignIcon />,
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
