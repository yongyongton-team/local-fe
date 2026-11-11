import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderApp } from '@/test/renderApp';

/**
 * 내 정보(/me)로 들어가는 길: 주민은 하단 내비의 네 번째 항목, 사장님·예비 창업자는 우측 상단 아이콘.
 * 첫 화면(역할 없음)과 내 정보·동네 선택에는 어느 쪽도 없다.
 */
/** 주민 내비 ④ 가게 간판(storefront, 27×26)의 path 앞부분 */
const STOREFRONT_ICON_PATH = 'path[d^="M4.01953 14.1211"]';
/** 사장님·창업자 우측 상단 내 정보 아이콘(사람 + 방패 체크, 25×26)의 path 앞부분 */
const MY_INFO_ICON_PATH = 'path[d^="M9.86719 10.2188"]';
/** 이전에 쓰던 사람들+소리 물결 SVG 의 path 앞부분. 어디에도 없어야 한다. */
const OLD_PEOPLE_ICON_PATH = 'path[d^="M6.45117 10.415"]';
const residentNav = () => within(screen.getByRole('navigation', { name: '주민 메뉴' }));
const cornerLink = () => screen.getByRole('link', { name: '내 정보' });

const heading1 = (name: string | RegExp) => screen.findByRole('heading', { level: 1, name });

describe('주민: 하단 내비의 네 번째 항목', () => {
  it.each(['/resident', '/resident/requests/new', '/resident/requests'])(
    '%s 에서 항목 4개가 탐색·가게 요청·내 요청·내 정보 순서로 있고 마지막이 내 정보(/me)다',
    async (path) => {
      renderApp([path]);
      await heading1(/.+/);

      const links = residentNav().getAllByRole('link');
      expect(links.map((link) => link.textContent)).toEqual([
        '탐색',
        '가게 요청',
        '내 요청',
        '내 정보',
      ]);
      expect(links[3]).toHaveAttribute('href', '/me');
      expect(links[3]).toHaveAccessibleName('내 정보');
    },
  );

  it('내 정보 항목은 가게 간판(storefront) 아이콘만 보이고 이름은 보조 기술에만 전달된다(터치 영역 44px 은 공통 스타일)', async () => {
    renderApp(['/resident']);
    await heading1('동네 탐색');

    const link = residentNav().getByRole('link', { name: '내 정보' });
    const svg = link.querySelector('svg')!;
    // Figma 노드 45:458(storefront)을 내보낸 SVG(27×26)의 path 를 그대로 쓰고 색은 currentColor 다.
    expect(svg).toHaveAttribute('width', '27');
    expect(svg).toHaveAttribute('height', '26');
    expect(svg.querySelector(STOREFRONT_ICON_PATH)).not.toBeNull();
    expect(svg.querySelector('path')).toHaveAttribute('fill', 'currentColor');
    // 우측 상단의 내 정보 아이콘(사람 + 방패 체크)이 아니다.
    expect(svg.querySelector(MY_INFO_ICON_PATH)).toBeNull();
    expect(link.querySelector('.visually-hidden')).toHaveTextContent('내 정보');
  });

  it('내비 ④ 아이콘은 ③(내 요청: 사람+방패 체크)과 다른 그림이다', async () => {
    renderApp(['/resident']);
    await heading1('동네 탐색');

    const icon = (name: string) =>
      residentNav().getByRole('link', { name }).querySelector('svg')!.innerHTML;
    expect(icon('내 정보')).not.toBe(icon('내 요청'));
    expect(icon('내 정보')).not.toBe(icon('가게 요청'));
    expect(icon('내 정보')).not.toBe(icon('탐색'));
  });

  it('네 번째 항목을 누르면 /me(내 정보 화면)로 가고, 거기에는 하단 내비가 없다', async () => {
    const user = userEvent.setup();
    const { router } = renderApp(['/resident']);
    await heading1('동네 탐색');

    await user.click(residentNav().getByRole('link', { name: '내 정보' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/me'));
    expect(await heading1('내 정보')).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('기존 ①~③의 이동과 현재 항목 표시는 그대로다', async () => {
    const user = userEvent.setup();
    const { router } = renderApp(['/resident']);
    await heading1('동네 탐색');
    const current = () =>
      residentNav()
        .getAllByRole('link')
        .filter((link) => link.getAttribute('aria-current') === 'page')
        .map((link) => link.textContent);
    expect(current()).toEqual(['탐색']);

    await user.click(residentNav().getByRole('link', { name: '가게 요청' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/resident/requests/new'));
    expect(current()).toEqual(['가게 요청']);

    await user.click(residentNav().getByRole('link', { name: '내 요청' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/resident/requests'));
    expect(current()).toEqual(['내 요청']);

    await user.click(residentNav().getByRole('link', { name: '탐색' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/resident'));
    expect(current()).toEqual(['탐색']);
  });

  it('주민 화면들의 헤더(우측 상단)에는 내 정보 아이콘이 없고 내 정보 링크는 내비의 것 하나뿐이다', async () => {
    const user = userEvent.setup();
    const { router } = renderApp(['/']);
    // 동네를 고르고 시작해야 탐색 화면의 헤더가 그려진다(선택이 없으면 안내만 나온다).
    await screen.findByRole('option', { name: '기흥구 구성동' });
    await user.click(screen.getByRole('radio', { name: /^주민/ }));
    await user.click(screen.getByRole('button', { name: '시작하기' }));
    await heading1('동네 탐색');
    expect(screen.getByRole('button', { name: '검색' })).toBeInTheDocument();

    for (const path of ['/resident', '/resident/requests/new', '/resident/requests']) {
      await act(() => router.navigate(path));
      await heading1(/.+/);

      expect(screen.getAllByRole('link', { name: '내 정보' })).toHaveLength(1);
      // 주민 화면에는 우측 상단용 아이콘(사람 + 방패 체크)이 없고 내비의 가게 간판 하나뿐이다. 이전 사람들 아이콘도 없다.
      expect(document.querySelector(MY_INFO_ICON_PATH)).toBeNull();
      expect(document.querySelectorAll(STOREFRONT_ICON_PATH)).toHaveLength(1);
      expect(document.querySelector('main')?.querySelector(STOREFRONT_ICON_PATH)).toBeNull();
      expect(document.querySelector(OLD_PEOPLE_ICON_PATH)).toBeNull();
      expect(screen.queryByRole('button', { name: '이웃 보기' })).not.toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: '생기면 갈게요 메인으로 이동' }).parentElement,
      ).not.toHaveClass('corner');
    }
  });
});

describe('사장님·예비 창업자: 우측 상단 내 정보 아이콘', () => {
  it.each([
    ['사장님 탐색', '/merchant'],
    ['사장님 동네 상세', '/merchant/areas/guseong'],
    ['창업자 입지 찾기', '/founder'],
    ['창업자 동네 리포트', '/founder/areas/guseong/report'],
  ])('%s(%s)에 "내 정보" 아이콘이 있고 /me 로 연결된다', async (_name, path) => {
    renderApp([path]);
    await heading1(/.+/);

    const links = screen.getAllByRole('link', { name: '내 정보' });
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute('href', '/me');
    // 디자인 원본 SVG(25×26)의 path 를 그대로 쓰고 색은 currentColor 다.
    const svg = links[0]!.querySelector('svg')!;
    expect(svg).toHaveAttribute('width', '25');
    expect(svg).toHaveAttribute('height', '26');
    expect(svg.querySelector(MY_INFO_ICON_PATH)).not.toBeNull();
    expect(svg.querySelector('path')).toHaveAttribute('fill', 'currentColor');
    // 하단 내비는 여전히 없고, 이전 사람들+소리 물결 아이콘(이웃 보기)은 어디에도 없다.
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(document.querySelector(OLD_PEOPLE_ICON_PATH)).toBeNull();
    expect(document.querySelectorAll(MY_INFO_ICON_PATH)).toHaveLength(1);
    expect(screen.queryByRole('button', { name: '이웃 보기' })).not.toBeInTheDocument();
  });

  it('아이콘은 본문(main) 밖 화면 우측 상단 자리에 있고, 로고는 그대로 왼쪽에 있다', async () => {
    renderApp(['/merchant']);
    await heading1(/.+/);

    expect(cornerLink().closest('main')).toBeNull();
    expect(cornerLink().parentElement).toHaveClass('corner');
    expect(screen.getByRole('link', { name: '생기면 갈게요 메인으로 이동' })).toBeInTheDocument();
  });

  it('누르면 /me 로 이동하고 거기에는 아이콘도 내비도 없다', async () => {
    const user = userEvent.setup();
    const { router } = renderApp(['/founder']);
    await heading1('입지 찾기');

    await user.click(cornerLink());

    await waitFor(() => expect(router.state.location.pathname).toBe('/me'));
    expect(await heading1('내 정보')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '내 정보' })).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });
});

describe('진입점이 없는 화면', () => {
  it.each([
    ['첫 화면(역할 없음)', '/'],
    ['내 정보', '/me'],
    ['동네 선택', '/me/dong'],
    ['없는 주소', '/nowhere'],
  ])('%s(%s)에는 내 정보 아이콘도 하단 내비도 없다', async (_name, path) => {
    renderApp([path]);
    await heading1(/.+/);

    expect(screen.queryByRole('link', { name: '내 정보' })).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(document.querySelector(MY_INFO_ICON_PATH)).toBeNull();
    expect(document.querySelector('a[href="/me"]')).toBeNull();
  });
});

describe('역할을 오가는 흐름', () => {
  it('사장님 화면의 아이콘 → /me → 주민 칩 → 주민 첫 화면(내비) → 내비의 내 정보 → /me 로 왕복할 수 있다', async () => {
    const user = userEvent.setup();
    const { router } = renderApp(['/']);

    await screen.findByRole('option', { name: '기흥구 구성동' });
    await user.click(screen.getByRole('radio', { name: /^사장님/ }));
    await user.click(screen.getByRole('button', { name: '시작하기' }));
    await heading1('내 업종을 원하는 동네');
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();

    // 사장님: 우측 상단 아이콘 → 내 정보
    await user.click(cornerLink());
    await waitFor(() => expect(router.state.location.pathname).toBe('/me'));
    await screen.findByText(/^ID : /);
    expect(screen.getByRole('radio', { name: '사장님' })).toBeChecked();

    // 역할을 주민으로 바꾸면 주민 첫 화면으로 가고 하단 내비가 나타난다.
    await user.click(screen.getByRole('radio', { name: '주민' }));
    await heading1('동네 탐색');
    expect(router.state.location.pathname).toBe('/resident');
    expect(screen.getByRole('navigation', { name: '주민 메뉴' })).toBeInTheDocument();
    expect(residentNav().getByRole('link', { name: '내 정보' })).toBeInTheDocument();

    // 주민: 하단 내비의 내 정보 → /me 로 돌아온다.
    await user.click(residentNav().getByRole('link', { name: '내 정보' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/me'));
    await screen.findByText(/^ID : /);
    expect(screen.getByRole('radio', { name: '주민' })).toBeChecked();

    // 예비 창업자로 바꾸면 창업자 화면과 우측 상단 아이콘이 나온다.
    await user.click(screen.getByRole('radio', { name: '예비 창업자' }));
    await heading1('입지 찾기');
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(cornerLink()).toHaveAttribute('href', '/me');
  });
});
