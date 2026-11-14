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
  within(screen.getByRole('region', { name: '인구에 비해 가게가 부족한 동네' })).queryAllByRole(
    'listitem',
  );
const mapRegion = () => screen.getByRole('region', { name: '입지 후보 지도(예시)' });
const select = () => screen.getByRole('combobox', { name: '어떤 가게를 열고 싶으세요?' });
const pills = () => within(mapRegion()).queryAllByRole('listitem');
const moreButton = () => screen.getByRole('button', { name: /^부족하지 않은 동네 \d+곳 더 보기$/ });
const live = () => mapRegion().querySelector('[aria-live="polite"]') as HTMLElement;

afterEach(() => vi.restoreAllMocks());

describe('렌더링', () => {
  it('h1, 질문과 연결된 select(기본 과일 / 채소 가게), 섹션 제목과 부제를 보여준다', async () => {
    await openFounder();

    expect(screen.getByRole('img', { name: '생기면 갈게요' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: '입지 찾기' })).toBeInTheDocument();
    expect(select()).toHaveDisplayValue('과일 / 채소 가게');
    expect(
      screen.getByRole('heading', { level: 2, name: '인구에 비해 가게가 부족한 동네' }),
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

  it('접힌 기본 상태에서 NOT_SHORT 3곳을 뺀 6개 행을 목 서버 순서 그대로 보여주고 번호는 서버 순위다(5·6·7위는 건너뛴다)', async () => {
    await openFounder();

    const rows = rankRows();
    expect(rows.map((row) => row.querySelector('a')?.textContent?.split('요청')[0])).toEqual([
      '1. 구성동',
      '2. 예시동 라',
      '3. 예시동 가',
      '4. 보정동',
      '8. 예시동 다',
      '9. 마북동',
    ]);
    expect(rows[0]).toHaveTextContent('요청 29명 · 같은 업종 0곳 · 대형마트 2.4km');
    expect(rows[3]).toHaveTextContent('요청 14명 · 같은 업종 1곳 · 대형마트 1.9km');
    expect(rows[5]).toHaveTextContent('요청 9명 · 같은 업종 0곳 · 대형마트 3.1km');
  });

  it('요청 수로 다시 정렬하지 않는다: 요청이 더 많은 행이 아래에 있어도 그대로다', async () => {
    await openFounder();

    const counts = rankRows().map((row) => Number(/요청 (\d+)명/.exec(row.textContent ?? '')?.[1]));
    expect(counts).toEqual([29, 3, 0, 14, 1, 9]);
    expect(counts).not.toEqual([...counts].sort((a, b) => b - a));
  });

  it('요청 0명 동네도 숨기지 않고 기존 줄 그대로 "요청 0명"으로 보인다', async () => {
    await openFounder();

    const row = rankRows()[2]!;
    expect(row).toHaveTextContent('3. 예시동 가');
    expect(row).toHaveTextContent('요청 0명 · 같은 업종 0곳');
  });

  it('공공데이터 줄: "기대 N곳 · 실제 M곳"(기대는 반올림, 실제는 그대로)과 서버 판정 문구', async () => {
    const user = userEvent.setup();
    await openFounder();

    const rows = rankRows();
    // 10.5 → 11, 7.2 → 7, 8 → 8, 6.7 → 7
    expect(rows[0]).toHaveTextContent('기대 11곳 · 실제 3곳 · [임의] 가게가 많이 부족해요');
    expect(rows[1]).toHaveTextContent(
      '기대 7곳 · 실제 2곳 · [임의] 인구에 비해 가게가 많이 부족하고',
    );
    expect(rows[2]).toHaveTextContent('기대 8곳 · 실제 5곳 · [임의] 근처에 가게가 조금 있어요');
    expect(rows[3]).toHaveTextContent('기대 7곳 · 실제 4곳 · [임의] 옆 동네에 가게가 있어요');
    // 접힌 NOT_SHORT 행도 펼치면 같은 형식이다(9 → 9)
    await user.click(moreButton());
    expect(rankRows()[6]).toHaveTextContent('기대 9곳 · 실제 12곳 · [임의] 부족하지 않아요');
  });

  it('NOT_JUDGED 는 접히지 않고 숫자 없이 판정 문구만 보인다', async () => {
    await openFounder();

    const row = rankRows()[4]!;
    expect(row).toHaveTextContent('8. 예시동 다');
    expect(row).toHaveTextContent('[임의] 공공데이터가 부족해 판단하지 못했어요');
    expect(row).not.toHaveTextContent('기대');
    expect(row).not.toHaveTextContent('실제');
  });

  it('공공데이터가 없는 행은 접히지 않고 기존 두 줄 그대로이며 아무것도 더 보이지 않는다', async () => {
    await openFounder();

    const row = rankRows()[5]!;
    expect(row).toHaveTextContent('9. 마북동');
    expect(row).not.toHaveTextContent('기대');
    expect(row).not.toHaveTextContent('[임의]');
    expect(row.textContent).toBe('9. 마북동요청 9명 · 같은 업종 0곳 · 대형마트 3.1km');
  });

  it('순위 목록은 ol 이고 행 링크 이름이 한 문장으로 읽히며 행 안에는 링크 하나뿐이다', async () => {
    await openFounder();

    expect(rankRows()[0]!.closest('ol')).not.toBeNull();
    // 숫자와 판정 문구까지 한 문장으로 읽힌다.
    expect(
      screen.getByRole('link', {
        name: '1. 구성동, 요청 29명, 같은 업종 0곳, 대형마트 2.4km, 기대 11곳 · 실제 3곳 · [임의] 가게가 많이 부족해요',
      }),
    ).toBeInTheDocument();
    // 공공데이터가 없는 행은 기존 이름 그대로다.
    expect(
      screen.getByRole('link', { name: '9. 마북동, 요청 9명, 같은 업종 0곳, 대형마트 3.1km' }),
    ).toBeInTheDocument();
    rankRows().forEach((row) => {
      expect(within(row).getAllByRole('link')).toHaveLength(1);
      expect(within(row).queryAllByRole('button')).toHaveLength(0);
    });
  });

  it('지도 알약 3개는 서버 순위 번호 라벨이고(위치가 없는 예시동은 알약이 없다) 지도에는 이름·요약·임시 표시가 있다', async () => {
    await openFounder();

    expect(pills().map((p) => p.textContent)).toEqual(['1. 구성동', '4. 보정동', '9. 마북동']);
    await waitFor(() => expect(live()).toHaveTextContent('과일 / 채소 가게 기준 동네 3곳 표시 중'));
    expect(within(mapRegion()).getByText('지도 연동 예정 · 예시 데이터')).toBeInTheDocument();
  });

  it('서비스가 remote(API 모드)이면 지도 영역 이름에 "(예시)"가 없고 mock 안내 대신 "지도를 불러오지 못했어요"가 보인다', async () => {
    const service = founderService as { remote: boolean };
    const original = service.remote;
    service.remote = true;
    try {
      await openFounder();

      const region = screen.getByRole('region', { name: '입지 후보 지도' });
      expect(
        screen.queryByRole('region', { name: '입지 후보 지도(예시)' }),
      ).not.toBeInTheDocument();
      expect(within(region).getByText('지도를 불러오지 못했어요')).toBeInTheDocument();
      expect(screen.queryByText('지도 연동 예정 · 예시 데이터')).not.toBeInTheDocument();
    } finally {
      service.remote = original;
    }
  });

  it('하단 내비게이션도 헤더 버튼(검색·이웃 보기)도 없고, 우측 상단의 내 정보 링크만 있다', async () => {
    await openFounder();

    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '검색' })).not.toBeInTheDocument();
    // 사람들+소리 물결 아이콘("이웃 보기" 임시 버튼)은 내 정보 아이콘으로 대신했다.
    expect(screen.queryByRole('button', { name: '이웃 보기' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '내 정보' })).toHaveAttribute('href', '/me');
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
    expect(screen.getByRole('link', { name: /^9\. 마북동/ })).toHaveAttribute(
      'href',
      '/founder/areas/mabuk/report?category=fruit-vegetable',
    );
  });

  it('행을 누르면 그 동네 리포트가 열린다', async () => {
    const user = userEvent.setup();
    await openFounder();

    await user.click(screen.getByRole('link', { name: /^4\. 보정동/ }));

    expect(await heading1('보정동 / 과일 가게')).toBeInTheDocument();
  });
});

describe('업종 선택과 쿼리', () => {
  it('업종을 바꾸면 그 업종의 목록과 지도 알약으로 바뀐다(공공데이터 줄은 없다)', async () => {
    const user = userEvent.setup();
    await openFounder();

    await user.selectOptions(select(), '반찬가게');

    await waitFor(() => expect(rankRows()).toHaveLength(1));
    expect(rankRows()[0]).toHaveTextContent('1. 구성동');
    expect(rankRows()[0]).toHaveTextContent('요청 12명 · 같은 업종 0곳');
    // 대형마트 값이 없으면 그 부분이 빠진다.
    expect(rankRows()[0]).not.toHaveTextContent('대형마트');
    expect(rankRows()[0]).not.toHaveTextContent('기대');
    expect(pills().map((p) => p.textContent)).toEqual(['1. 구성동']);
    expect(live()).toHaveTextContent('반찬가게 기준 동네 1곳 표시 중');
    expect(screen.getByRole('link', { name: /^1\. 구성동/ })).toHaveAttribute(
      'href',
      '/founder/areas/guseong/report?category=side-dish',
    );
  });

  it('쿼리(?category=)로 진입하면 그 업종이 선택된다', async () => {
    const user = userEvent.setup();
    renderApp(['/founder?category=bakery']);

    await waitFor(() => expect(select()).toHaveDisplayValue('빵집'));
    // 빵집은 모두 NOT_SHORT 라 접힌 상태로 시작한다.
    await user.click(await screen.findByRole('button', { name: '부족하지 않은 동네 1곳 더 보기' }));
    expect(await screen.findByRole('link', { name: /^1\. 구성동/ })).toHaveTextContent('요청 6명');
  });

  it('쿼리 값이 올바르지 않으면 기본 업종으로 처리한다', async () => {
    await openFounder('/founder?category=nope');

    expect(select()).toHaveDisplayValue('과일 / 채소 가게');
    expect(rankRows()).toHaveLength(6);
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
    await user.click(await screen.findByRole('button', { name: '부족하지 않은 동네 1곳 더 보기' }));
    await user.click(await screen.findByRole('link', { name: /^1\. 구성동, 요청 6명/ }));
    expect(await heading1('구성동 / 빵집')).toBeInTheDocument();
    await act(() => router.navigate(-1));

    await waitFor(() => expect(select()).toHaveDisplayValue('빵집'));
    // 화면을 새로 만들어 돌아오면 접힌 상태다.
    await user.click(await screen.findByRole('button', { name: '부족하지 않은 동네 1곳 더 보기' }));
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

describe('부족하지 않은 동네(NOT_SHORT) 접기', () => {
  const linkNames = () =>
    rankRows().map((row) => row.querySelector('a')?.textContent?.split('요청')[0]);
  const COLLAPSED = [
    '1. 구성동',
    '2. 예시동 라',
    '3. 예시동 가',
    '4. 보정동',
    '8. 예시동 다',
    '9. 마북동',
  ];
  const FOLDED = ['5. 예시동 나', '6. 예시동 마', '7. 예시동 바'];

  it('기본은 접힌 상태라 NOT_SHORT 행이 없고, 버튼에 접힌 개수가 보이며 aria-expanded 는 false 다', async () => {
    await openFounder();

    expect(linkNames()).toEqual(COLLAPSED);
    for (const name of FOLDED) {
      expect(screen.queryByRole('link', { name: new RegExp(`^${name}`) })).not.toBeInTheDocument();
    }
    const button = screen.getByRole('button', { name: '부족하지 않은 동네 3곳 더 보기' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('버튼은 보이는 행 뒤에 있다(목록 아래)', async () => {
    await openFounder();

    const list = rankRows()[0]!.closest('ol')!;
    expect(
      list.compareDocumentPosition(moreButton()) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('누르면 접힌 행이 서버 순위 번호 그대로 보이고 버튼은 "접기"(aria-expanded=true)가 되며, 다시 누르면 접힌다', async () => {
    const user = userEvent.setup();
    await openFounder();

    await user.click(moreButton());

    expect(linkNames()).toEqual([...COLLAPSED, ...FOLDED]);
    const button = screen.getByRole('button', { name: '접기' });
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(screen.queryByRole('button', { name: /더 보기$/ })).not.toBeInTheDocument();

    await user.click(button);

    expect(linkNames()).toEqual(COLLAPSED);
    expect(moreButton()).toHaveAttribute('aria-expanded', 'false');
  });

  it('펼쳐도 다시 정렬하지 않는다: 접힌 행은 서버 순서(5→6→7) 그대로 보이는 행 뒤에 붙는다', async () => {
    const user = userEvent.setup();
    await openFounder();
    await user.click(moreButton());

    const ranks = rankRows().map((row) => Number(/^(\d+)\./.exec(row.textContent ?? '')?.[1]));
    expect(ranks).toEqual([1, 2, 3, 4, 8, 9, 5, 6, 7]);
    expect(ranks.slice(6)).toEqual([...ranks.slice(6)].sort((a, b) => a - b));
  });

  it('업종을 바꾸면 접힌 상태로 돌아가고, 같은 업종으로 되돌아와도 접혀 있다', async () => {
    const user = userEvent.setup();
    await openFounder();
    await user.click(moreButton());
    expect(screen.getByRole('button', { name: '접기' })).toBeInTheDocument();

    await user.selectOptions(select(), '빵집');
    // 빵집은 모두 NOT_SHORT 라 접힌 상태: 버튼이 "더 보기"이고 행이 없다.
    expect(
      await screen.findByRole('button', { name: '부족하지 않은 동네 1곳 더 보기' }),
    ).toHaveAttribute('aria-expanded', 'false');
    await user.click(moreButton());
    expect(screen.getByRole('button', { name: '접기' })).toBeInTheDocument();

    await user.selectOptions(select(), '과일 / 채소 가게');
    await waitFor(() => expect(linkNames()).toEqual(COLLAPSED));
    expect(moreButton()).toHaveTextContent('부족하지 않은 동네 3곳 더 보기');
  });

  it('NOT_SHORT 가 없는 업종에는 버튼이 없다', async () => {
    const user = userEvent.setup();
    await openFounder();

    await user.selectOptions(select(), '반찬가게');

    await waitFor(() => expect(rankRows()).toHaveLength(1));
    expect(screen.queryByRole('button', { name: /더 보기$|^접기$/ })).not.toBeInTheDocument();
  });

  it('보이는 행이 하나도 없으면 안내를 보여주고 버튼은 남는다(기본은 접힘)', async () => {
    const user = userEvent.setup();
    renderApp(['/founder?category=bakery']);

    expect(
      await screen.findByText('인구에 비해 가게가 부족한 동네가 아직 없어요.'),
    ).toBeInTheDocument();
    expect(rankRows()).toHaveLength(0);
    expect(screen.queryByText('아직 요청이 없는 업종이에요')).not.toBeInTheDocument();
    const button = screen.getByRole('button', { name: '부족하지 않은 동네 1곳 더 보기' });
    expect(button).toHaveAttribute('aria-expanded', 'false');

    await user.click(button);

    expect(rankRows()).toHaveLength(1);
    expect(screen.getByRole('link', { name: /^1\. 구성동/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '접기' })).toBeInTheDocument();
  });

  it('지도 알약은 접힌 상태에서는 보이는 행만, 펼치면 모든 행이다', async () => {
    const user = userEvent.setup();
    renderApp(['/founder?category=bakery']);
    await screen.findByText('인구에 비해 가게가 부족한 동네가 아직 없어요.');

    // 보이는 행이 없으면 알약도 없다(목 모드는 지도 카드는 그대로 둔다).
    expect(pills()).toHaveLength(0);
    expect(live()).toHaveTextContent('빵집 기준 동네 0곳 표시 중');

    await user.click(moreButton());

    expect(pills().map((p) => p.textContent)).toEqual(['1. 구성동']);
    expect(live()).toHaveTextContent('빵집 기준 동네 1곳 표시 중');

    await user.click(screen.getByRole('button', { name: '접기' }));

    expect(pills()).toHaveLength(0);
  });

  it('과일 업종은 NOT_SHORT 행이 모두 위치 없는 예시동이라 펼쳐도 알약은 그대로 3개다', async () => {
    const user = userEvent.setup();
    await openFounder();

    await user.click(moreButton());

    expect(pills().map((p) => p.textContent)).toEqual(['1. 구성동', '4. 보정동', '9. 마북동']);
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
