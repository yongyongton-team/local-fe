import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, type RouteObject } from 'react-router';
import { AppProviders } from '@/app/providers';
import { routes as appRoutes } from '@/app/routes';

/**
 * 실제 앱과 같은 라우트·Provider 를 메모리 라우터로 렌더링한다. 네트워크는 사용하지 않는다.
 * @param routes 기본은 앱 라우트. 프로덕션 라우트 구성을 검증할 때 createRoutes() 결과를 넘긴다.
 */
export function renderApp(initialEntries: string[] = ['/'], routes: RouteObject[] = appRoutes) {
  const router = createMemoryRouter(routes, { initialEntries });
  return render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  );
}
