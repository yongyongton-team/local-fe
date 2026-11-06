import type { RouteObject } from 'react-router';

/**
 * 개발 환경 전용 라우트. routes.tsx 가 import.meta.env.DEV 일 때만 포함한다.
 * 페이지는 lazy 로 불러와 프로덕션 번들에 별도 코드가 남지 않게 한다.
 */
export const devRoutes: RouteObject[] = [
  {
    path: 'dev/design-system',
    lazy: async () => ({
      Component: (await import('@/pages/dev/DesignSystemPage')).DesignSystemPage,
    }),
  },
];
