import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppProviders } from '@/app/providers';
import { routes } from '@/app/routes';
import { founderService, requestSubmitter } from '@/services';
import { renderApp } from '@/test/renderApp';

const heading1 = (name: string) => screen.findByRole('heading', { level: 1, name });
/** 첫 화면 없이 /founder 로 직접 들어가고 순위 행이 보일 때까지 기다린다. */
async function openFounder(path = '/founder') {
  const view = renderApp([path]);
  await screen.findByRole('link', { name: /^1\./ });
  return view;
}
const rankRows = () =>
  within(screen.getByRole('region', { name: '요청은 많고 가게는 없는 동네' })).queryAllByRole(
    'listitem',
  );
const mapRegion = () => screen.getByRole('region', { name: '입지 후보 지도(예시)' });
const select = () => screen.getByRole('combobox', { name: '어떤 가게를 열고 싶으세요?' });
const pills = () => within(mapRegion()).queryAllByRole('listitem');
const live = () => mapRegion().querySelector('[aria-live="polite"]') as HTMLElement;

afterEach(() => vi.restoreAllMocks());

describe('렌더링', () => {
  it('h1, 질문과 연결된 select(기본 과일 / 채소 가게), 섹션 제목과 부제를 보여준다', async () => {
    await openFounder();

    expect(screen.getByRole('img', { name: '생기면 갈게요' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: '입지 찾기' })).toBeInTheDocument();
    expect(select()).toHaveDisplayValue('과일 / 채소 가게');
    expect(
      screen.getByRole('heading', { level: 2, name: '요청은 많고 가게는 없는 동네' }),
    ).toBeInTheDocument();
    expect(screen.getByText('용인시 행정동 순위')).toBeInTheDocument();
  });

  it('select 선택지는 업종 전체이고 카드 제목 표기를 쓴다', async () => {
    await openFounder();

    expect(
      within(select())
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['과일 / 채소 가게', '반찬가게', '빵집']);
  });

  it('순위 행 3개(구성동 → 보정동 → 마북동)와 문구를 보여준다', async () => {
    await openFounder();

    const rows = rankRows();
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent('1. 구성동');
    expect(rows[0]).toHaveTextContent('요청 29명 · 같은 업종 0곳 · 대형마트 2.4km');
    expect(rows[1]).toHaveTextContent('2. 보정동');
    expect(rows[1]).toHaveTextContent('요청 14명 · 같은 업종 1곳 · 대형마트 1.9km');
    expect(rows[2]).toHaveTextContent('3. 마북동');
    expect(rows[2]).toHaveTextContent('요청 9명 · 같은 업종 0곳 · 대형마트 3.1km');
  });

  it('순위 목록은 ol 이고 행 링크 이름이 한 문장으로 읽히며 행 안에는 링크 하나뿐이다', async () => {
    await openFounder();

    expect(rankRows()[0]!.closest('ol')).not.toBeNull();
    expect(
      screen.getByRole('link', { name: '1. 구성동, 요청 29명, 같은 업종 0곳, 대형마트 2.4km' }),
    ).toBeInTheDocument();
    rankRows().forEach((row) => {
      expect(within(row).getAllByRole('link')).toHaveLength(1);
      expect(within(row).queryAllByRole('button')).toHaveLength(0);
    });
  });

  it('지도 알약 3개는 번호 라벨이고 지도에는 이름·요약·임시 표시가 있다', async () => {
    await openFounder();

    expect(pills().map((p) => p.textContent)).toEqual(['1. 구성동', '2. 보정동', '3. 마북동']);
    await waitFor(() => expect(live()).toHaveTextContent('과일 / 채소 가게 기준 동네 3곳 표시 중'));
    expect(within(mapRegion()).getByText('지도 연동 예정 · 예시 데이터')).toBeInTheDocument();
  });

  it('검색 버튼과 하단 내비게이션이 없고 사람들 버튼 하나만 있다', async () => {
    await openFounder();

    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '검색' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '이웃 보기' })).toBeInTheDocument();
  });

  it('역할·동네 선택 없이 직접 들어와도 렌더링한다', async () => {
    renderApp(['/founder']);

    expect(await heading1('입지 찾기')).toBeInTheDocument();
  });
});

describe('첫 화면에서 들어오기', () => {
  it('예비 창업자를 고르고 시작하면 이 화면이 렌더링된다', async () => {
    const user = userEvent.setup();
    renderApp();

    await screen.findByRole('option', { name: '기흥구 구성동' });
    await user.click(screen.getByRole('radio', { name: /^예비 창업자/ }));
    await user.click(screen.getByRole('button', { name: '시작하기' }));

    expect(await heading1('입지 찾기')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /^1\. 구성동/ })).toBeInTheDocument();
  });
});

describe('링크', () => {
  it('순위 행은 /founder/areas/:areaId/report?category=... 를 가리킨다', async () => {
    await openFounder();

    expect(screen.getByRole('link', { name: /^1\. 구성동/ })).toHaveAttribute(
      'href',
      '/founder/areas/guseong/report?category=fruit-vegetable',
    );
    expect(screen.getByRole('link', { name: /^3\. 마북동/ })).toHaveAttribute(
      'href',
      '/founder/areas/mabuk/report?category=fruit-vegetable',
    );
  });

  it('행을 누르면 리포트(골격)가 열린다', async () => {
    const user = userEvent.setup();
    await openFounder();

    await user.click(screen.getByRole('link', { name: /^2\. 보정동/ }));

    expect(await heading1('보정동 리포트')).toBeInTheDocument();
  });
});

describe('업종 선택과 쿼리', () => {
  it('업종을 바꾸면 목록과 지도 알약이 바뀌고 순위가 1부터 다시 매겨진다', async () => {
    const user = userEvent.setup();
    await openFounder();

    await user.selectOptions(select(), '반찬가게');

    await waitFor(() => expect(rankRows()).toHaveLength(1));
    expect(rankRows()[0]).toHaveTextContent('1. 구성동');
    expect(rankRows()[0]).toHaveTextContent('요청 12명 · 같은 업종 0곳');
    // 대형마트 값이 없으면 그 부분이 빠진다.
    expect(rankRows()[0]).not.toHaveTextContent('대형마트');
    expect(pills().map((p) => p.textContent)).toEqual(['1. 구성동']);
    expect(live()).toHaveTextContent('반찬가게 기준 동네 1곳 표시 중');
    expect(screen.getByRole('link', { name: /^1\. 구성동/ })).toHaveAttribute(
      'href',
      '/founder/areas/guseong/report?category=side-dish',
    );
  });

  it('쿼리(?category=)로 진입하면 그 업종이 선택된다', async () => {
    renderApp(['/founder?category=bakery']);

    await waitFor(() => expect(select()).toHaveDisplayValue('빵집'));
    expect(await screen.findByRole('link', { name: /^1\. 구성동/ })).toHaveTextContent('요청 6명');
  });

  it('쿼리 값이 올바르지 않으면 기본 업종으로 처리한다', async () => {
    await openFounder('/founder?category=nope');

    expect(select()).toHaveDisplayValue('과일 / 채소 가게');
    expect(rankRows()).toHaveLength(3);
  });

  it('업종을 바꾸면 URL 쿼리가 갱신되고, 리포트에서 브라우저 뒤로 가기로 돌아오면 선택이 유지된다', async () => {
    const user = userEvent.setup();
    const router = createMemoryRouter(routes, { initialEntries: ['/founder'] });
    render(
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>,
    );
    await screen.findByRole('link', { name: /^1\./ });

    await user.selectOptions(select(), '빵집');
    expect(router.state.location.search).toBe('?category=bakery');
    await user.click(await screen.findByRole('link', { name: /^1\. 구성동, 요청 6명/ }));
    expect(await heading1('구성동 리포트')).toBeInTheDocument();
    await act(() => router.navigate(-1));

    await waitFor(() => expect(select()).toHaveDisplayValue('빵집'));
    expect(await screen.findByRole('link', { name: /^1\. 구성동, 요청 6명/ })).toBeInTheDocument();
  });

  it('업종을 연속으로 바꿔도 기록을 쌓지 않아 뒤로 가면 이전 화면으로 돌아간다', async () => {
    const user = userEvent.setup();
    const router = createMemoryRouter(routes, {
      initialEntries: ['/merchant', '/founder'],
      initialIndex: 1,
    });
    render(
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>,
    );
    await screen.findByRole('link', { name: /^1\./ });

    await user.selectOptions(select(), '반찬가게');
    await user.selectOptions(select(), '빵집');
    expect(select()).toHaveDisplayValue('빵집');
    await act(() => router.navigate(-1));

    expect(await heading1('내 업종을 원하는 동네')).toBeInTheDocument();
  });
});

describe('상태', () => {
  it('불러오는 동안 안내를 보여준다', async () => {
    renderApp(['/founder']);

    expect(screen.getByRole('status')).toHaveTextContent('불러오는 중이에요.');
    await screen.findByRole('link', { name: /^1\./ });
  });

  it('업종에 수요 데이터가 없으면 빈 상태를 보여주고 지도 알약은 없다', async () => {
    vi.spyOn(founderService, 'listLocationRanks').mockResolvedValue([]);
    renderApp(['/founder']);

    expect(await screen.findByText('아직 요청이 없는 업종이에요')).toBeInTheDocument();
    expect(rankRows()).toHaveLength(0);
    expect(pills()).toHaveLength(0);
    expect(live()).toHaveTextContent('과일 / 채소 가게 기준 동네 0곳 표시 중');
  });

  it('조회가 실패하면 오류 안내를 보여준다', async () => {
    vi.spyOn(founderService, 'listLocationRanks').mockRejectedValue(new Error('x'));
    renderApp(['/founder']);

    expect(await screen.findByText('데이터를 가져오지 못했어요')).toBeInTheDocument();
  });
});

describe('주민 요청과의 연동', () => {
  it('주민이 과일/채소 요청을 보내면 구성동 인원이 30명으로 이 화면에 반영된다', async () => {
    await requestSubmitter.submit({
      neighborhoodId: 'guseong',
      categoryId: 'fruit-vegetable',
      detail: '과일가게요',
      conditions: [],
      visitTimes: [],
    });
    renderApp(['/founder']);

    expect(await screen.findByText(/요청 30명 · 같은 업종 0곳/)).toBeInTheDocument();
  });
});
