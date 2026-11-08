import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';
import { LogoLink } from './LogoLink';

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: '/', element: <h1>메인</h1> },
      { path: '/other', element: <LogoLink /> },
    ],
    { initialEntries: [path] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

describe('LogoLink', () => {
  it('서비스 이름이 들어간 이름의 링크(<a>)이고 /로 간다', () => {
    renderAt('/other');

    const link = screen.getByRole('link', { name: '생기면 갈게요 메인으로 이동' });
    expect(link.tagName).toBe('A');
    expect(link).toHaveAttribute('href', '/');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('링크 이름이 로고 alt 와 겹쳐 두 번 읽히지 않는다(링크 이름 하나만 있다)', () => {
    renderAt('/other');

    const link = screen.getByRole('link', { name: '생기면 갈게요 메인으로 이동' });
    expect(screen.getAllByRole('link')).toHaveLength(1);
    // 링크는 aria-label 로 이름을 덮어 안쪽 이미지 alt 가 이름에 더해지지 않는다.
    expect(link).toHaveAttribute('aria-label', '생기면 갈게요 메인으로 이동');
    expect(link).toHaveAccessibleName('생기면 갈게요 메인으로 이동');
  });

  it('크기는 로고 그대로(129×43)이고 누르면 메인으로 이동한다', async () => {
    const user = userEvent.setup();
    const router = renderAt('/other');

    const img = screen.getByRole('img', { name: '생기면 갈게요' });
    expect(img).toHaveAttribute('width', '129');
    expect(img).toHaveAttribute('height', '43');
    await user.click(screen.getByRole('link', { name: '생기면 갈게요 메인으로 이동' }));

    expect(router.state.location.pathname).toBe('/');
    expect(await screen.findByRole('heading', { name: '메인' })).toBeInTheDocument();
  });

  it('키보드로 포커스하고 Enter 로 이동한다', async () => {
    const user = userEvent.setup();
    const router = renderAt('/other');

    await user.tab();
    expect(screen.getByRole('link', { name: '생기면 갈게요 메인으로 이동' })).toHaveFocus();
    await user.keyboard('{Enter}');

    expect(router.state.location.pathname).toBe('/');
  });
});
