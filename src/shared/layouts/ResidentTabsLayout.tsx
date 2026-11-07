import { Outlet } from 'react-router';
import { paths } from '@/shared/lib/paths';
import { BottomNav } from '@/shared/ui/BottomNav';
import { LinkPlusIcon, MapIcon, PersonShieldIcon } from '@/shared/ui/icons';
import { MobileLayout } from './MobileLayout';

/*
 * 임시안: Figma 하단 내비는 이름 없는 아이콘 3개뿐이라 아래처럼 임시로 매핑했다.
 *   지도 아이콘 → 탐색(/resident), 링크+ 아이콘 → 가게 요청(/resident/requests/new),
 *   사람+방패 아이콘 → 내 요청(/resident/requests)
 * 표시 범위(임시 규칙)는 그대로다: 주민 화면 /resident, /resident/requests 에만 보이고
 * 첫 화면·요청 작성·상세·리포트에서는 숨긴다.
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
