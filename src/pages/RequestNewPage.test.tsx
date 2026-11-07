import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect, useRef } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppProviders } from '@/app/providers';
import { routes } from '@/app/routes';
import { SUMMARY_DEBOUNCE_MS } from '@/features/store-request/constants';
import { useSelection } from '@/features/selection/SelectionContext';
import { requestSubmitter } from '@/services';
import type { StoreRequest } from '@/types/domain';
import { renderApp } from '@/test/renderApp';

const NEIGHBORHOOD = { id: 'guseong', district: '기흥구', name: '구성동' };
const EXAMPLE = '밤 10시까지 하는 과일가게요. 낱개로 살 수 있으면 좋겠어요.';
const AMBIGUOUS = '맛있는 가게가 생기면 좋겠어요';

/** 선택된 역할·동네를 주입한다. 첫 화면을 거치지 않으므로 이 화면이 앱에서 처음 연 화면(직접 진입)이 된다. */
function SeedSelection() {
  const { select } = useSelection();
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    select('resident', NEIGHBORHOOD);
  }, [select]);
  return null;
}

function renderRequestPage(entries = ['/resident/requests/new'], index?: number) {
  const router = createMemoryRouter(routes, { initialEntries: entries, initialIndex: index });
  return render(
    <AppProviders>
      <SeedSelection />
      <RouterProvider router={router} />
    </AppProviders>,
  );
}

const setup = () => userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

/** 입력이 멈춘 뒤의 정리 지연을 흘려보낸다. */
const flushSummary = () =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(SUMMARY_DEBOUNCE_MS + 10);
  });

const textbox = () => screen.getByRole('textbox', { name: '어떤 가게가 생기면 갈까요?' });
const sendButton = () => screen.getByRole('button', { name: /요청 보내기/ });
const summaryCard = () => screen.queryByRole('region', { name: '요청 정리 결과' });

async function typeAndSummarize(user: ReturnType<typeof setup>, text: string) {
  await user.type(textbox(), text);
  await flushSummary();
}

beforeEach(() => {
  vi.useFakeTimers();
  // React Testing Library 는 `jest` 전역이 있을 때만 비동기 대기 중에 가짜 타이머를 진행시킨다.
  // vitest 에는 그 전역이 없어 user-event 가 멈추므로, 이 파일에서만 같은 역할의 스텁을 둔다.
  vi.stubGlobal('jest', { advanceTimersByTime: (ms: number) => vi.advanceTimersByTime(ms) });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('렌더링', () => {
  it('h1, label 과 연결된 입력창, 칩 그룹, 위치 문구를 보여준다', () => {
    renderRequestPage();

    expect(screen.getByRole('heading', { level: 1, name: '가게 요청하기' })).toBeInTheDocument();
    // 질문 제목이 입력창의 label 이다.
    expect(textbox()).toHaveAttribute('placeholder', '원하는 가게와 조건을 자유롭게 적어 주세요');
    expect(textbox()).toHaveAttribute('maxlength', '200');
    expect(screen.getByRole('group', { name: '언제 가실 것 같아요?' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: '얼마나 자주요?' })).toBeInTheDocument();
    expect(screen.getByText('위치 : 기흥구 구성동 (동 단위로만 저장해요)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '뒤로 가기' })).toBeInTheDocument();
  });

  it('하단 내비를 보여주고 가운데(가게 요청) 항목이 현재 항목이다', () => {
    renderRequestPage();

    const nav = within(screen.getByRole('navigation', { name: '주민 메뉴' }));
    expect(nav.getByRole('link', { name: '가게 요청' })).toHaveAttribute('aria-current', 'page');
    expect(nav.getByRole('link', { name: '탐색' })).not.toHaveAttribute('aria-current');
    expect(nav.getByRole('link', { name: '내 요청' })).not.toHaveAttribute('aria-current');
  });

  it('선택된 동네가 없으면 폼 대신 선택 안내와 첫 화면 링크를 보여준다', () => {
    vi.useRealTimers();
    renderApp(['/resident/requests/new']);

    expect(screen.getByText('내 동네를 먼저 선택해 주세요')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '첫 화면으로' })).toHaveAttribute('href', '/');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
});

describe('입력과 AI 정리 카드', () => {
  it('입력이 비어 있으면 카드가 없고 요청 보내기는 비활성이다', async () => {
    const user = setup();
    renderRequestPage();

    expect(summaryCard()).not.toBeInTheDocument();
    expect(sendButton()).toBeDisabled();

    // 공백뿐인 입력도 비어 있는 것으로 본다.
    await user.type(textbox(), '   ');
    await flushSummary();
    expect(summaryCard()).not.toBeInTheDocument();
    expect(sendButton()).toBeDisabled();
  });

  it('A: 예시 문장은 업종 "과일 / 채소 가게"와 조건 "늦게까지 영업 / 낱개 구매"로 정리된다', async () => {
    const user = setup();
    renderRequestPage();

    await typeAndSummarize(user, EXAMPLE);

    const card = within(summaryCard()!);
    expect(card.getByText('이렇게 정리했어요')).toBeInTheDocument();
    expect(card.getByText('과일 / 채소 가게')).toBeInTheDocument();
    expect(card.getByText('늦게까지 영업 / 낱개 구매')).toBeInTheDocument();
    expect(card.getByText('문장을 바꾸면 다시 정리해요!')).toBeInTheDocument();
    // 업종을 바꾸는 수단이 없다(후보 칩이 없다).
    expect(card.queryByRole('group', { name: '업종 후보' })).not.toBeInTheDocument();
    // 실제 AI 분석처럼 보이지 않게 예시임을 표시한다.
    expect(card.getByText('예시 정리 · AI 연동 예정')).toBeInTheDocument();
    expect(sendButton()).toBeEnabled();
  });

  it('조건이 하나도 추출되지 않으면 "조건" 줄을 숨긴다', async () => {
    const user = setup();
    renderRequestPage();

    await typeAndSummarize(user, '빵집이 생기면 좋겠어요');

    const card = within(summaryCard()!);
    expect(card.getByText('빵집')).toBeInTheDocument();
    expect(card.queryByText('조건')).not.toBeInTheDocument();
  });

  it('B: 업종이 정해지지 않으면 후보 칩 3개와 안내를 보여주고 제출은 비활성이다', async () => {
    const user = setup();
    renderRequestPage();

    await typeAndSummarize(user, AMBIGUOUS);

    const card = within(summaryCard()!);
    expect(card.getByText('가장 가까운 업종을 선택해 주세요!')).toBeInTheDocument();
    expect(card.getByText('선택해 주세요')).toBeInTheDocument();
    const choices = within(card.getByRole('group', { name: '업종 후보' })).getAllByRole('radio');
    expect(choices.map((radio) => radio.getAttribute('value'))).toEqual([
      'fruit-vegetable',
      'side-dish',
      'bakery',
    ]);
    choices.forEach((radio) => expect(radio).not.toBeChecked());
    expect(sendButton()).toBeDisabled();
  });

  it('B: 업종 후보를 고르면 카드의 "업종" 값에 반영되고 제출이 활성화된다', async () => {
    const user = setup();
    renderRequestPage();
    await typeAndSummarize(user, AMBIGUOUS);

    await user.click(screen.getByRole('radio', { name: '반찬 가게' }));

    expect(screen.getByRole('radio', { name: '반찬 가게' })).toBeChecked();
    const card = within(summaryCard()!);
    expect(card.queryByText('선택해 주세요')).not.toBeInTheDocument();
    expect(card.getAllByText('반찬 가게').length).toBeGreaterThan(0);
    expect(sendButton()).toBeEnabled();
  });

  it('업종 키워드가 둘 이상이면 모호하므로 B 상태가 된다', async () => {
    const user = setup();
    renderRequestPage();

    await typeAndSummarize(user, '과일이랑 빵을 같이 팔면 좋겠어요');

    expect(within(summaryCard()!).getByRole('group', { name: '업종 후보' })).toBeInTheDocument();
  });

  it('입력을 지우면 카드가 사라지고 고른 업종도 초기화된다', async () => {
    const user = setup();
    renderRequestPage();
    await typeAndSummarize(user, AMBIGUOUS);
    await user.click(screen.getByRole('radio', { name: '빵집' }));

    await user.clear(textbox());
    await flushSummary();
    expect(summaryCard()).not.toBeInTheDocument();
    expect(sendButton()).toBeDisabled();

    await typeAndSummarize(user, AMBIGUOUS);
    screen.getAllByRole('radio', { name: /가게|빵집/ }).forEach((radio) => {
      expect(radio).not.toBeChecked();
    });
  });

  it('정리 결과를 보이지 않는 aria-live 영역으로 알린다', async () => {
    const user = setup();
    renderRequestPage();
    const live = () => document.querySelector('[aria-live="polite"]') as HTMLElement;
    expect(live()).toHaveTextContent('');

    await typeAndSummarize(user, EXAMPLE);

    expect(live()).toHaveTextContent(
      '요청 정리 결과: 업종 과일 / 채소 가게, 조건 늦게까지 영업, 낱개 구매',
    );
  });
});

describe('방문 시간대와 빈도', () => {
  it('시간대는 복수 선택(토글)이다', async () => {
    const user = setup();
    renderRequestPage();
    const time = (name: string) => screen.getByRole('button', { name });

    expect(time('평일 저녁')).toHaveAttribute('aria-pressed', 'false');
    await user.click(time('평일 저녁'));
    await user.click(time('주말'));
    expect(time('평일 저녁')).toHaveAttribute('aria-pressed', 'true');
    expect(time('주말')).toHaveAttribute('aria-pressed', 'true');
    expect(time('평일 낮')).toHaveAttribute('aria-pressed', 'false');

    await user.click(time('평일 저녁'));
    expect(time('평일 저녁')).toHaveAttribute('aria-pressed', 'false');
    expect(time('주말')).toHaveAttribute('aria-pressed', 'true');
  });

  it('빈도는 단일 선택(라디오)이고 처음에는 아무것도 선택되지 않는다', async () => {
    const user = setup();
    renderRequestPage();
    const group = within(screen.getByRole('group', { name: '얼마나 자주요?' }));
    group.getAllByRole('radio').forEach((radio) => expect(radio).not.toBeChecked());

    await user.click(group.getByRole('radio', { name: '주 1번 이상' }));
    expect(group.getByRole('radio', { name: '주 1번 이상' })).toBeChecked();

    await user.click(group.getByRole('radio', { name: '가끔' }));
    expect(group.getByRole('radio', { name: '가끔' })).toBeChecked();
    expect(group.getByRole('radio', { name: '주 1번 이상' })).not.toBeChecked();
  });
});

describe('요청 보내기', () => {
  const saved: StoreRequest = {
    id: 'saved',
    neighborhoodId: 'guseong',
    categoryId: 'fruit-vegetable',
    detail: EXAMPLE,
    conditions: ['늦게까지 영업', '낱개 구매'],
    visitTimes: [],
  };

  it('성공하면 선택값과 정리 결과를 제출하고 /resident/requests(내 요청)로 이동한다', async () => {
    const user = setup();
    const submit = vi.spyOn(requestSubmitter, 'submit').mockResolvedValue(saved);
    renderRequestPage();
    await typeAndSummarize(user, EXAMPLE);
    await user.click(screen.getByRole('button', { name: '평일 저녁' }));
    await user.click(screen.getByRole('button', { name: '주말' }));
    await user.click(screen.getByRole('radio', { name: '주 1번 이상' }));

    await user.click(sendButton());

    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledWith({
      neighborhoodId: 'guseong',
      categoryId: 'fruit-vegetable',
      detail: EXAMPLE,
      conditions: ['늦게까지 영업', '낱개 구매'],
      visitTimes: ['weekday-evening', 'weekend'],
      visitFrequency: 'weekly',
    });
    expect(await screen.findByRole('heading', { level: 1, name: '내 요청' })).toBeInTheDocument();
  });

  it('시간대와 빈도를 고르지 않아도 제출할 수 있다', async () => {
    const user = setup();
    const submit = vi.spyOn(requestSubmitter, 'submit').mockResolvedValue(saved);
    renderRequestPage();
    await typeAndSummarize(user, EXAMPLE);

    await user.click(sendButton());

    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({ visitTimes: [], visitFrequency: undefined }),
    );
  });

  it('제출 중에는 loading 상태가 되어 중복 제출되지 않는다', async () => {
    const user = setup();
    let finish!: (request: StoreRequest) => void;
    const submit = vi.spyOn(requestSubmitter, 'submit').mockImplementation(
      () =>
        new Promise<StoreRequest>((resolve) => {
          finish = resolve;
        }),
    );
    renderRequestPage();
    await typeAndSummarize(user, EXAMPLE);

    await user.click(sendButton());
    await user.click(sendButton());
    await user.click(sendButton());

    expect(sendButton()).toHaveAttribute('aria-busy', 'true');
    expect(submit).toHaveBeenCalledTimes(1);

    await act(async () => finish(saved));
    expect(await screen.findByRole('heading', { level: 1, name: '내 요청' })).toBeInTheDocument();
  });

  it('실패하면 버튼 위에 오류 문구를 보여주고 입력은 유지한다', async () => {
    const user = setup();
    vi.spyOn(requestSubmitter, 'submit').mockRejectedValueOnce(new Error('network'));
    renderRequestPage();
    await typeAndSummarize(user, EXAMPLE);

    await user.click(sendButton());

    expect(await screen.findByRole('alert')).toHaveTextContent('요청을 보내지 못했어요');
    expect(textbox()).toHaveValue(EXAMPLE);
    expect(sendButton()).not.toHaveAttribute('aria-busy');
    expect(sendButton()).toBeEnabled();
    expect(screen.getByRole('heading', { level: 1, name: '가게 요청하기' })).toBeInTheDocument();
  });

  it('입력을 고치면 오류 문구가 사라진다', async () => {
    const user = setup();
    vi.spyOn(requestSubmitter, 'submit').mockRejectedValueOnce(new Error('network'));
    renderRequestPage();
    await typeAndSummarize(user, EXAMPLE);
    await user.click(sendButton());
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    await user.type(textbox(), '!');

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('입력 직후 정리가 끝나기 전에는 보낼 수 없다(오래된 정리 결과로 제출하지 않는다)', async () => {
    const user = setup();
    renderRequestPage();
    await typeAndSummarize(user, EXAMPLE);
    expect(sendButton()).toBeEnabled();

    await user.type(textbox(), '!');

    expect(sendButton()).toBeDisabled();
    await flushSummary();
    expect(sendButton()).toBeEnabled();
  });
});

describe('뒤로가기', () => {
  it('앱 안에서 이전 화면이 있으면 그 화면으로 돌아간다', async () => {
    const user = setup();
    renderRequestPage(['/merchant', '/resident/requests/new'], 1);

    await user.click(screen.getByRole('button', { name: '뒤로 가기' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: '수요 동네 탐색' }),
    ).toBeInTheDocument();
  });

  it('직접 진입했으면 /resident(동네 탐색)로 이동한다', async () => {
    const user = setup();
    renderRequestPage(['/resident/requests/new']);

    await user.click(screen.getByRole('button', { name: '뒤로 가기' }));

    expect(await screen.findByRole('heading', { level: 1, name: '동네 탐색' })).toBeInTheDocument();
  });
});

describe('동네 탐색에서 들어오기', () => {
  it('"+가게 요청하기"를 누르면 이 화면이 열리고 내비 가운데 항목이 선택된다', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    renderApp();
    await screen.findByRole('option', { name: '기흥구 구성동' });
    await user.click(screen.getByRole('radio', { name: /^주민/ }));
    await user.click(screen.getByRole('button', { name: '시작하기' }));
    await screen.findByRole('region', { name: '동네 지도(예시)' });

    await user.click(screen.getByRole('link', { name: '+가게 요청하기' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: '가게 요청하기' }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('navigation', { name: '주민 메뉴' })).getByRole('link', {
        name: '가게 요청',
      }),
    ).toHaveAttribute('aria-current', 'page');
    // 첫 화면에서 고른 동네가 위치 문구에 쓰인다.
    expect(screen.getByText('위치 : 기흥구 구성동 (동 단위로만 저장해요)')).toBeInTheDocument();
  });

  it('하단 내비 가운데 아이콘으로도 들어온다', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    renderApp(['/resident']);

    await user.click(
      within(screen.getByRole('navigation', { name: '주민 메뉴' })).getByRole('link', {
        name: '가게 요청',
      }),
    );

    expect(
      await screen.findByRole('heading', { level: 1, name: '가게 요청하기' }),
    ).toBeInTheDocument();
  });
});
