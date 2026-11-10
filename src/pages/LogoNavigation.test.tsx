import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect, useRef } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';
import { AppProviders } from '@/app/providers';
import { routes } from '@/app/routes';
import { useSelection } from '@/features/selection/SelectionContext';
import { renderApp } from '@/test/renderApp';

const LOGO_LINK = '생기면 갈게요 메인으로 이동';

/** 선택된 역할·동네를 주입한다(주민 화면은 동네 선택이 있어야 지도·로고가 나온다). */
function SeedSelection() {
  const { select } = useSelection();
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    select('resident', { id: 'guseong', district: '기흥구', name: '구성동' });
  }, [select]);
  return null;
}

function renderSeeded(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <AppProviders>
      <SeedSelection />
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return router;
}

const homeHeading = () =>
  screen.findByRole('heading', { level: 1, name: /우리 동네에 없는 가게,\s*원하면 생겨요/ });

/** 로고가 있는 화면: [경로, 화면 이름, 데이터가 도착한 뒤의 h1] */
const SCREENS = [
  ['/resident', '주민 탐색', '동네 탐색'],
  ['/resident/requests/new', '가게 요청 작성', '가게 요청하기'],
  ['/resident/requests', '내 요청', '내 요청'],
  ['/merchant', '사장님 탐색', '내 업종을 원하는 동네'],
  ['/merchant/areas/guseong', '사장님 동네 상세', '구성동 / 과일 가게'],
  ['/founder', '창업자 탐색', '입지 찾기'],
  ['/founder/areas/guseong/report', '창업자 동네 리포트', '구성동 / 과일 가게'],
] as const;

describe('모든 화면의 로고는 메인 페이지로 가는 링크다', () => {
  it.each(SCREENS)(
    '%s (%s): 로고 링크가 / 를 가리키고 누르면 메인으로 이동한다',
    async (path, _name, h1) => {
      const user = userEvent.setup();
      const router = renderSeeded(path);

      // 데이터가 도착해 화면이 자리 잡은 뒤에 누른다(로딩 화면의 로고를 누르지 않도록).
      await screen.findByRole('heading', { level: 1, name: h1 });
      const link = await screen.findByRole('link', { name: LOGO_LINK });
      expect(link).toHaveAttribute('href', '/');
      expect(screen.getByRole('img', { name: '생기면 갈게요' })).toBeInTheDocument();

      await user.click(link);

      expect(router.state.location.pathname).toBe('/');
      expect(await homeHeading()).toBeInTheDocument();
    },
  );

  it('로고 링크는 화면마다 하나뿐이다(<a> 하나, 로고 버튼 없음)', async () => {
    for (const [path, , h1] of SCREENS) {
      const router = createMemoryRouter(routes, { initialEntries: [path] });
      const view = render(
        <AppProviders>
          <SeedSelection />
          <RouterProvider router={router} />
        </AppProviders>,
      );
      await screen.findByRole('heading', { level: 1, name: h1 });
      const links = await screen.findAllByRole('link', { name: LOGO_LINK });
      expect(links).toHaveLength(1);
      view.unmount();
    }
  });
});

describe('메인 페이지', () => {
  it('메인 페이지의 로고는 링크가 아니다(자기 자신으로 가는 링크를 만들지 않는다)', async () => {
    renderApp(['/']);

    expect(await screen.findByRole('img', { name: '생기면 갈게요' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: LOGO_LINK })).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: '생기면 갈게요' }).closest('a')).toBeNull();
  });
});

describe('로고로 메인에 가도 선택한 역할·동네는 유지된다', () => {
  it('창업자를 고르고 시작한 뒤 로고를 누르면 메인에 창업자와 동네가 그대로 선택돼 있다', async () => {
    const user = userEvent.setup();
    renderApp(['/']);
    await screen.findByRole('option', { name: '기흥구 구성동' });
    await user.selectOptions(screen.getByLabelText('내 동네'), '기흥구 보정동');
    await user.click(screen.getByRole('radio', { name: /^예비 창업자/ }));
    await user.click(screen.getByRole('button', { name: '시작하기' }));
    await screen.findByRole('heading', { level: 1, name: '입지 찾기' });

    await user.click(screen.getByRole('link', { name: LOGO_LINK }));

    expect(await homeHeading()).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /^예비 창업자/ })).toBeChecked();
    expect(screen.getByLabelText('내 동네')).toHaveDisplayValue('기흥구 보정동');
  });

  it('요청 작성 중에 로고를 누르면 입력 문장은 사라지고(확인 팝업 없음) 메인으로 이동한다', async () => {
    const user = userEvent.setup();
    const router = renderSeeded('/resident/requests/new');
    const textbox = await screen.findByRole('textbox');
    await user.type(textbox, '밤 10시까지 하는 과일가게요');
    expect(textbox).toHaveValue('밤 10시까지 하는 과일가게요');

    await user.click(screen.getByRole('link', { name: LOGO_LINK }));
    expect(await homeHeading()).toBeInTheDocument();
    // 다시 들어오면 입력은 비어 있다.
    await router.navigate('/resident/requests/new');

    expect(await screen.findByRole('textbox')).toHaveValue('');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
