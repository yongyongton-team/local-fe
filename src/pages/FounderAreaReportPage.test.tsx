import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppProviders } from '@/app/providers';
import { routes } from '@/app/routes';
import * as services from '@/services';
import { founderService, requestSubmitter } from '@/services';
import { renderApp } from '@/test/renderApp';

const heading1 = (name: string) => screen.findByRole('heading', { level: 1, name });
const region = (name: string) => screen.getByRole('region', { name });
/** 카드의 dt 이름 → dd 값 */
const stat = (name: string) =>
  screen.getByText(name, { selector: 'dt' }).nextElementSibling?.textContent;
const sentence = () => within(region('왜 이 동네인가요?')).getByText(/원해요\./);
const shareButton = () => screen.getByRole('button', { name: '리포트 공유하기' });

function stubNavigator(name: 'share' | 'clipboard', value: unknown) {
  Object.defineProperty(navigator, name, { value, configurable: true, writable: true });
}

afterEach(() => {
  vi.restoreAllMocks();
  Reflect.deleteProperty(navigator, 'share');
  Reflect.deleteProperty(navigator, 'clipboard');
});

describe.each([
  {
    id: 'guseong',
    title: '구성동 / 과일 가게',
    cards: ['29명', '0곳', '2.4km', '평일 저녁'],
    text: '구성동은 주민 29명이 과일·채소 가게를 원해요. 걸어서 15분 안에 같은 업종은 0곳이고, 가장 가까운 대형마트는 2.4km 떨어져 있어요. 요청은 평일 저녁에 몰려 있어요.',
  },
  {
    id: 'bojeong',
    title: '보정동 / 과일 가게',
    cards: ['14명', '1곳', '1.9km', '주말'],
    text: '보정동은 주민 14명이 과일·채소 가게를 원해요. 걸어서 15분 안에 같은 업종은 1곳이고, 가장 가까운 대형마트는 1.9km 떨어져 있어요. 요청은 주말에 몰려 있어요.',
  },
  {
    id: 'mabuk',
    title: '마북동 / 과일 가게',
    cards: ['9명', '0곳', '3.1km', '평일 낮'],
    text: '마북동은 주민 9명이 과일·채소 가게를 원해요. 걸어서 15분 안에 같은 업종은 0곳이고, 가장 가까운 대형마트는 3.1km 떨어져 있어요. 요청은 평일 낮에 몰려 있어요.',
  },
])('$title', ({ id, title, cards, text }) => {
  it('제목, 카드 4개, 설명 문장, 근거 데이터 4줄을 보여준다', async () => {
    renderApp([`/founder/areas/${id}/report`]);

    expect(await heading1(title)).toBeInTheDocument();
    expect(
      ['주민 요청', '걸어서 15분 안 같은 업종', '가장 가까운 대형마트', '많이 원하는 시간'].map(
        stat,
      ),
    ).toEqual(cards);
    expect(await within(region('왜 이 동네인가요?')).findByText(text)).toBeInTheDocument();
    expect(
      within(region('근거 데이터'))
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual([
      '가게 위치: 소상공인시장진흥공단 상가(상권)정보',
      '대형마트: 경기도 용인시 대규모 점포 현황(2026.5.7)',
      '동 경계: 통계청 SGIS 행정동 경계',
      '주민 요청: 이 서비스',
    ]);
  });
});

describe('구조와 접근성', () => {
  it('카드는 dt/dd 쌍이고 AI 배지는 장식이며 안내와 예시 표시가 보인다', async () => {
    renderApp(['/founder/areas/guseong/report']);
    await heading1('구성동 / 과일 가게');

    expect(document.querySelectorAll('dl > div > dt')).toHaveLength(4);
    const why = region('왜 이 동네인가요?');
    expect(within(why).getByText('AI')).toHaveAttribute('aria-hidden', 'true');
    expect(within(why).getByText('예시 문장 · AI 연동 예정')).toBeInTheDocument();
    expect(within(why).getByText('숫자는 서버가 계산하고, 문장만 AI가 써요')).toBeInTheDocument();
    expect(
      within(region('근거 데이터')).getByText(
        '이 화면의 수치는 개발용 예시 데이터이며 위 출처의 실제 수치가 아니에요.',
      ),
    ).toBeInTheDocument();
  });

  it('근거 데이터는 h2 와 ul 이고 문장은 aria-live 영역이다', async () => {
    renderApp(['/founder/areas/guseong/report']);
    await heading1('구성동 / 과일 가게');

    expect(screen.getByRole('heading', { level: 2, name: '근거 데이터' })).toBeInTheDocument();
    expect(within(region('근거 데이터')).getByRole('list')).toBeInTheDocument();
    await waitFor(() => expect(sentence()).toBeInTheDocument());
    expect(sentence()).toHaveAttribute('aria-live', 'polite');
  });

  it('하단 내비게이션이 없고 직접 진입해도 렌더링한다', async () => {
    renderApp(['/founder/areas/mabuk/report']);

    expect(await heading1('마북동 / 과일 가게')).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });
});

describe('업종 쿼리', () => {
  it('?category=side-dish 이면 반찬 데이터를 보여주고 대형마트가 없으면 "정보 없음"이다', async () => {
    renderApp(['/founder/areas/guseong/report?category=side-dish']);

    expect(await heading1('구성동 / 반찬 가게')).toBeInTheDocument();
    expect(stat('주민 요청')).toBe('12명');
    expect(stat('가장 가까운 대형마트')).toBe('정보 없음');
    expect(
      await within(region('왜 이 동네인가요?')).findByText(
        '구성동은 주민 12명이 반찬 가게를 원해요. 걸어서 15분 안에 같은 업종은 0곳이에요. 요청은 평일 저녁에 몰려 있어요.',
      ),
    ).toBeInTheDocument();
  });

  it('값이 없거나 올바르지 않으면 기본 업종(과일/채소)이다', async () => {
    const { unmount } = renderApp(['/founder/areas/guseong/report?category=nope']);
    expect(await heading1('구성동 / 과일 가게')).toBeInTheDocument();
    unmount();

    renderApp(['/founder/areas/guseong/report']);
    expect(await heading1('구성동 / 과일 가게')).toBeInTheDocument();
  });
});

describe('주민 요청과의 연동', () => {
  it('주민이 과일/채소 요청을 보내면 구성동 인원이 29에서 30으로 카드와 문장에 반영된다', async () => {
    const { unmount } = renderApp(['/founder/areas/guseong/report']);
    await heading1('구성동 / 과일 가게');
    expect(stat('주민 요청')).toBe('29명');
    unmount();

    await requestSubmitter.submit({
      neighborhoodId: 'guseong',
      categoryId: 'fruit-vegetable',
      detail: '과일가게요',
      conditions: [],
      visitTimes: [],
    });
    renderApp(['/founder/areas/guseong/report']);

    await heading1('구성동 / 과일 가게');
    expect(stat('주민 요청')).toBe('30명');
    expect(await screen.findByText(/주민 30명이 과일·채소 가게를 원해요/)).toBeInTheDocument();
  });
});

describe('상태', () => {
  it('불러오는 동안 안내를 보여준다', async () => {
    renderApp(['/founder/areas/guseong/report']);

    expect(screen.getByRole('status')).toHaveTextContent('불러오는 중이에요.');
    await heading1('구성동 / 과일 가게');
  });

  it('없는 areaId 는 찾을 수 없음 안내와 업종을 유지한 /founder 링크를 보여준다', async () => {
    renderApp(['/founder/areas/unknown/report?category=bakery']);

    expect(await screen.findByText('찾을 수 없는 동네예요')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '입지 찾기로' })).toHaveAttribute(
      'href',
      '/founder?category=bakery',
    );
    expect(screen.queryByRole('button', { name: '리포트 공유하기' })).not.toBeInTheDocument();
  });

  it('그 업종의 수요 데이터가 없는 동네도 찾을 수 없음이다', async () => {
    renderApp(['/founder/areas/mabuk/report?category=bakery']);

    expect(await screen.findByText('찾을 수 없는 동네예요')).toBeInTheDocument();
  });

  it('조회가 실패하면 오류 안내를 보여준다', async () => {
    vi.spyOn(founderService, 'getAreaReport').mockRejectedValue(new Error('x'));
    renderApp(['/founder/areas/guseong/report']);

    expect(await screen.findByText('데이터를 가져오지 못했어요')).toBeInTheDocument();
  });

  it('문장 생성이 실패해도 수치 카드는 그대로 보이고 문장 자리에만 오류 문구가 나온다', async () => {
    vi.spyOn(services.reportDescriptionGenerator, 'generate').mockRejectedValue(new Error('x'));
    renderApp(['/founder/areas/guseong/report']);

    expect(await heading1('구성동 / 과일 가게')).toBeInTheDocument();
    expect(
      await within(region('왜 이 동네인가요?')).findByText('문장을 불러오지 못했어요.'),
    ).toBeInTheDocument();
    expect(stat('주민 요청')).toBe('29명');
  });
});

describe('뒤로 가기', () => {
  it('이전 화면이 있으면 그 화면으로 돌아간다', async () => {
    const user = userEvent.setup();
    renderApp(['/merchant', '/founder/areas/guseong/report'], undefined, 1);
    await heading1('구성동 / 과일 가게');

    await user.click(screen.getByRole('button', { name: '뒤로 가기' }));

    expect(await heading1('내 업종을 원하는 동네')).toBeInTheDocument();
  });

  it('직접 진입했으면 업종을 유지한 /founder?category= 로 이동한다', async () => {
    const user = userEvent.setup();
    const router = createMemoryRouter(routes, {
      initialEntries: ['/founder/areas/guseong/report?category=bakery'],
    });
    render(
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>,
    );
    await heading1('구성동 / 빵집');

    await user.click(screen.getByRole('button', { name: '뒤로 가기' }));

    expect(await heading1('입지 찾기')).toBeInTheDocument();
    expect(router.state.location.pathname + router.state.location.search).toBe(
      '/founder?category=bakery',
    );
    expect(screen.getByRole('combobox', { name: '어떤 가게를 열고 싶으세요?' })).toHaveDisplayValue(
      '빵집',
    );
  });
});

describe('입지 찾기에서 들어오기', () => {
  it('순위 행을 누르면 그 동네 리포트가 열리고 선택한 업종이 유지된다', async () => {
    const user = userEvent.setup();
    const router = createMemoryRouter(routes, { initialEntries: ['/founder'] });
    render(
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>,
    );
    await screen.findByRole('link', { name: /^1\./ });
    await user.selectOptions(
      screen.getByRole('combobox', { name: '어떤 가게를 열고 싶으세요?' }),
      '반찬가게',
    );

    await user.click(await screen.findByRole('link', { name: /^1\. 구성동, 요청 12명/ }));

    expect(await heading1('구성동 / 반찬 가게')).toBeInTheDocument();
    expect(router.state.location.search).toBe('?category=side-dish');
    expect(stat('주민 요청')).toBe('12명');
    // 브라우저 뒤로 가기로 돌아오면 선택이 유지된다.
    await act(() => router.navigate(-1));
    await waitFor(() =>
      expect(
        screen.getByRole('combobox', { name: '어떤 가게를 열고 싶으세요?' }),
      ).toHaveDisplayValue('반찬가게'),
    );
  });
});

describe('리포트 공유하기', () => {
  const expectedText =
    '구성동은 주민 29명이 과일·채소 가게를 원해요. 걸어서 15분 안에 같은 업종은 0곳이고, 가장 가까운 대형마트는 2.4km 떨어져 있어요. 요청은 평일 저녁에 몰려 있어요.';
  const expectedUrl = `${window.location.origin}/founder/areas/guseong/report?category=fruit-vegetable`;

  async function open(path = '/founder/areas/guseong/report') {
    const user = userEvent.setup();
    renderApp([path]);
    await heading1('구성동 / 과일 가게');
    // 공유 문구가 문장이 되도록 문장이 만들어질 때까지 기다린다. 클립보드·share 스텁은 userEvent.setup 뒤에 덮어쓴다.
    await within(region('왜 이 동네인가요?')).findByText(expectedText);
    return user;
  }

  it('Web Share 를 지원하면 문장과 현재 리포트 주소(?category= 포함)로 공유한다', async () => {
    const user = await open();
    const share = vi.fn().mockResolvedValue(undefined);
    stubNavigator('share', share);

    await user.click(shareButton());

    expect(share).toHaveBeenCalledTimes(1);
    expect(share).toHaveBeenCalledWith({ text: expectedText, url: expectedUrl });
    expect(screen.queryByText('링크를 복사했어요')).not.toBeInTheDocument();
    expect(JSON.stringify(share.mock.calls)).not.toContain('생기면');
  });

  it('지원하지 않으면 주소를 복사하고 "링크를 복사했어요"를 aria-live 로 알린다', async () => {
    const user = await open('/founder/areas/guseong/report?category=fruit-vegetable');
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubNavigator('clipboard', { writeText });

    await user.click(shareButton());

    expect(writeText).toHaveBeenCalledWith(expectedUrl);
    const notice = await screen.findByText('링크를 복사했어요');
    expect(notice).toHaveAttribute('aria-live', 'polite');
  });

  it('공유를 취소하면 아무 문구도 띄우지 않는다', async () => {
    const user = await open();
    stubNavigator('share', vi.fn().mockRejectedValue(new DOMException('canceled', 'AbortError')));
    stubNavigator('clipboard', { writeText: vi.fn() });

    await user.click(shareButton());

    await waitFor(() => expect(shareButton()).toBeEnabled());
    expect(screen.queryByText('링크를 복사했어요')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('복사까지 실패하면 오류 문구를 보여준다', async () => {
    const user = await open();
    stubNavigator('clipboard', { writeText: vi.fn().mockRejectedValue(new Error('denied')) });

    await user.click(shareButton());

    expect(await screen.findByRole('alert')).toHaveTextContent('공유하지 못했어요');
  });
});
