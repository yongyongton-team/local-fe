import type { RouteObject } from 'react-router';
import { FounderAreaReportPage } from '@/pages/FounderAreaReportPage';
import { FounderExplorePage } from '@/pages/FounderExplorePage';
import { DongSelectPage } from '@/pages/DongSelectPage';
import { HomePage } from '@/pages/HomePage';
import { MerchantAreaDetailPage } from '@/pages/MerchantAreaDetailPage';
import { MerchantOfferDetailPage } from '@/pages/MerchantOfferDetailPage';
import { MerchantOfferNewPage } from '@/pages/MerchantOfferNewPage';
import { MerchantOffersPage } from '@/pages/MerchantOffersPage';
import { MerchantExplorePage } from '@/pages/MerchantExplorePage';
import { MyInfoPage } from '@/pages/MyInfoPage';
import { MyRequestsPage } from '@/pages/MyRequestsPage';
import { ResidentOfferDetailPage } from '@/pages/ResidentOfferDetailPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { RequestNewPage } from '@/pages/RequestNewPage';
import { ResidentExplorePage } from '@/pages/ResidentExplorePage';
import { ShopEditPage } from '@/pages/ShopEditPage';
import { ResidentTabsLayout } from '@/shared/layouts/ResidentTabsLayout';
import { RoleLayout } from '@/shared/layouts/RoleLayout';
import { RootLayout } from '@/shared/layouts/RootLayout';
import { devRoutes } from './devRoutes';

/**
 * 라우트 정의. 라우터 생성 코드(router.tsx)와 분리해 테스트에서 메모리 라우터로 재사용한다.
 * 역할은 접근 권한이 아니므로 어떤 라우트도 선택 여부로 막거나 리다이렉트하지 않는다.
 * 레이아웃은 세 가지다: 주민(하단 내비 4개), 사장님·창업자(우측 상단 내 정보 아이콘), 그 밖(없음).
 *
 * @param extraRoutes 최상위에 덧붙일 라우트(개발 전용 페이지 등)
 */
export function createRoutes(extraRoutes: RouteObject[] = []): RouteObject[] {
  return [
    {
      // 하단 내비게이션은 주민 화면 /resident, /resident/requests/new, /resident/requests 에만 표시한다.
      element: <ResidentTabsLayout />,
      children: [
        { path: 'resident', element: <ResidentExplorePage /> },
        { path: 'resident/requests/new', element: <RequestNewPage /> },
        { path: 'resident/requests', element: <MyRequestsPage /> },
      ],
    },
    {
      // 사장님·예비 창업자 화면 전체: 하단 내비 없이 우측 상단에 "내 정보" 아이콘이 있다.
      element: <RoleLayout />,
      children: [
        { path: 'merchant', element: <MerchantExplorePage /> },
        { path: 'merchant/areas/:areaId', element: <MerchantAreaDetailPage /> },
        { path: 'merchant/offers', element: <MerchantOffersPage /> },
        { path: 'merchant/offers/new', element: <MerchantOfferNewPage /> },
        { path: 'merchant/offers/:offerId', element: <MerchantOfferDetailPage /> },
        { path: 'founder', element: <FounderExplorePage /> },
        { path: 'founder/areas/:areaId/report', element: <FounderAreaReportPage /> },
      ],
    },
    {
      // 내비도 우측 상단 아이콘도 없는 화면: 첫 화면, 내 정보, 동네 선택, 내 가게, 주민 제안 상세(시안에 내비·아이콘이 없다), 없는 주소
      element: <RootLayout />,
      children: [
        { index: true, element: <HomePage /> },
        { path: 'me', element: <MyInfoPage /> },
        { path: 'me/dong', element: <DongSelectPage /> },
        { path: 'me/shop', element: <ShopEditPage /> },
        { path: 'resident/offers/:offerId', element: <ResidentOfferDetailPage /> },
        { path: '*', element: <NotFoundPage /> },
      ],
    },
    ...extraRoutes,
  ];
}

/**
 * 앱이 사용하는 라우트. 개발 전용 라우트는 import.meta.env.DEV 가 true 일 때만 포함된다.
 * 프로덕션 빌드에서는 이 조건이 상수 false 로 치환되어 개발 전용 페이지 코드가 번들에서 빠진다.
 */
export const routes = createRoutes(import.meta.env.DEV ? devRoutes : []);
