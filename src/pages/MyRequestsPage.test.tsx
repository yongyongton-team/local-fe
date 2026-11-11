import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { myRequestService, requestSubmitter } from '@/services';
import type { MyRequest, NewStoreRequest } from '@/types/domain';
import { renderApp } from '@/test/renderApp';

const SIDE_DISH_SUMMARY = '구성동에서 반찬 가게를 원하는 주민이 12명이 됐어요.';
const FRUIT_SUMMARY = '구성동에서 과일·채소 가게를 원하는 주민이 30명이 됐어요.';

const fruitRequest = (overrides: Partial<NewStoreRequest> = {}): NewStoreRequest => ({
  neighborhoodId: 'guseong',
  categoryId: 'fruit-vegetable',
  detail: '과일가게요',
  conditions: [],
  visitTimes: ['weekday-evening'],
  visitFrequency: 'weekly',
  ...overrides,
});

/** 요청 목록 화면을 열고 데이터가 보일 때까지 기다린다. */
async function openMyRequests() {
  renderApp(['/resident/requests']);
  await screen.findByRole('heading', { level: 2, name: '내 요청' });
}

const summaryCard = () => screen.getByRole('region', { name: '요청했어요!' });
const listSection = () =>
  within(screen.getByRole('heading', { level: 2, name: '내 요청' }).closest('section')!);
const cards = () => listSection().getAllByRole('article');

function stub(name: 'share' | 'clipboard', value: unknown) {
  Object.defineProperty(navigator, name, { value, configurable: true, writable: true });
}

afterEach(() => {
  vi.restoreAllMocks();
  Reflect.deleteProperty(navigator, 'share');
  Reflect.deleteProperty(navigator, 'clipboard');
});

describe('처음 진입한 상태(시드: 구성동 반찬 요청 1건)', () => {
  it('h1, 요약 카드, 공유 버튼, 요청 목록, 예시 데이터 표시를 보여준다', async () => {
    await openMyRequests();

    expect(screen.getByRole('heading', { level: 1, name: '내 요청' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '생기면 갈게요' })).toBeInTheDocument();
    expect(screen.getByText('예시 데이터')).toBeInTheDocument();
    expect(summaryCard()).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '이웃에게 알리기 (링크 공유)' })).toBeInTheDocument();
    expect(cards()).toHaveLength(1);
    // 뒤로가기 화살표는 없다.
    expect(screen.queryByRole('button', { name: '뒤로 가기' })).not.toBeInTheDocument();
  });

  it('요약 카드: 반찬 12명, 막대 12/30, 결정 필요는 없다', async () => {
    await openMyRequests();

    const card = within(summaryCard());
    expect(card.getByText(SIDE_DISH_SUMMARY)).toBeInTheDocument();
    expect(card.getByText('12명이 모였어요!')).toBeInTheDocument();
    expect(card.queryByText('결정 필요')).not.toBeInTheDocument();
    expect(card.getByText('30명이 모이면 근처 가게에 알려요')).toBeInTheDocument();

    const bar = card.getByRole('progressbar', { name: '12명이 모였어요!' });
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '30');
    expect(bar).toHaveAttribute('aria-valuenow', '12');
    expect(bar).toHaveAttribute('aria-valuetext', '12명이 모였어요 (기준 30명)');
  });

  it('요청 카드: 제목, 인원, 메타 줄, 사장님 응답 박스(라벨과 메시지가 한 묶음)', async () => {
    await openMyRequests();

    const [card] = cards();
    const item = within(card!);
    expect(item.getByRole('heading', { level: 3, name: '반찬가게' })).toBeInTheDocument();
    expect(item.getByText('12명')).toBeInTheDocument();
    expect(item.getByText('구성동 · 평일 저녁 · 한 달 2~3번')).toBeInTheDocument();
    const response = item.getByRole('group', { name: '사장님 응답' });
    expect(response).toHaveTextContent(
      '맛나반찬: 토요일 오전 10시, 구성동 주민센터 앞에서 방문 판매해요',
    );
    expect(item.queryByText('아직 사장님 응답이 없어요')).not.toBeInTheDocument();
  });

  it('요청 카드 안에는 링크나 버튼이 없고 삭제할 요청을 고르는 체크만 있다', async () => {
    await openMyRequests();

    cards().forEach((card) => {
      expect(within(card).queryAllByRole('link')).toHaveLength(0);
      expect(within(card).queryAllByRole('button')).toHaveLength(0);
      expect(within(card).getAllByRole('checkbox')).toHaveLength(1);
    });
  });

  it('동네를 선택하지 않고 직접 들어와도 선택 안내 없이 그대로 보여준다', async () => {
    await openMyRequests();

    expect(screen.queryByText('내 동네를 먼저 선택해 주세요')).not.toBeInTheDocument();
    expect(summaryCard()).toBeInTheDocument();
  });

  it('하단 내비의 세 번째(내 요청)가 현재 항목이고 네 번째(내 정보)는 아니다', async () => {
    await openMyRequests();

    const nav = within(screen.getByRole('navigation', { name: '주민 메뉴' }));
    expect(nav.getByRole('link', { name: '내 요청' })).toHaveAttribute('aria-current', 'page');
    expect(nav.getByRole('link', { name: '탐색' })).not.toHaveAttribute('aria-current');
    expect(nav.getByRole('link', { name: '가게 요청' })).not.toHaveAttribute('aria-current');
    expect(nav.getByRole('link', { name: '내 정보' })).not.toHaveAttribute('aria-current');
  });
});

describe('과일/채소 요청을 보낸 뒤', () => {
  it('요약 카드가 30명·막대 가득·결정 필요가 되고, 그 카드는 사장님 응답이 없다', async () => {
    await requestSubmitter.submit(fruitRequest());
    await openMyRequests();

    const card = within(summaryCard());
    expect(card.getByText(FRUIT_SUMMARY)).toBeInTheDocument();
    expect(card.getByText('30명이 모였어요!')).toBeInTheDocument();
    expect(card.getByText('결정 필요')).toBeInTheDocument();
    expect(card.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '30');

    const [fruit, sideDish] = cards();
    expect(within(fruit!).getByRole('heading', { name: '과일 / 채소 가게' })).toBeInTheDocument();
    expect(within(fruit!).getByText('30명')).toBeInTheDocument();
    expect(within(fruit!).getByText('구성동 · 평일 저녁 · 주 1번 이상')).toBeInTheDocument();
    expect(within(fruit!).getByText('아직 사장님 응답이 없어요')).toBeInTheDocument();
    expect(within(fruit!).queryByRole('group', { name: '사장님 응답' })).not.toBeInTheDocument();
    // 기존 반찬 요청은 그대로 아래에 있다(최근 순).
    expect(within(sideDish!).getByRole('heading', { name: '반찬가게' })).toBeInTheDocument();
    expect(within(sideDish!).getByRole('group', { name: '사장님 응답' })).toBeInTheDocument();
  });

  it('시간대와 빈도를 고르지 않은 요청의 메타 줄에서는 그 부분이 빠진다', async () => {
    await requestSubmitter.submit(
      fruitRequest({ categoryId: 'bakery', visitTimes: [], visitFrequency: undefined }),
    );
    await openMyRequests();

    expect(within(cards()[0]!).getByText('구성동')).toBeInTheDocument();
  });

  it('시간대가 여럿이면 ", "로 이어 보여준다', async () => {
    await requestSubmitter.submit(fruitRequest({ visitTimes: ['weekend', 'weekday-day'] }));
    await openMyRequests();

    expect(
      within(cards()[0]!).getByText('구성동 · 평일 낮, 주말 · 주 1번 이상'),
    ).toBeInTheDocument();
  });

  it('입력한 원문 문장은 이 화면에 표시하지 않는다', async () => {
    await requestSubmitter.submit(fruitRequest({ detail: '아무도 보면 안 되는 원문 문장' }));
    await openMyRequests();

    expect(screen.queryByText(/아무도 보면 안 되는/)).not.toBeInTheDocument();
  });
});

describe('빈 상태와 로딩', () => {
  it('요청이 없으면 안내와 가게 요청하기 링크만 보이고 요약 카드·공유 버튼은 숨긴다', async () => {
    vi.spyOn(myRequestService, 'listMyRequests').mockResolvedValue([]);
    renderApp(['/resident/requests']);

    expect(await screen.findByText('아직 보낸 요청이 없어요')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '가게 요청하기' })).toHaveAttribute(
      'href',
      '/resident/requests/new',
    );
    expect(screen.queryByRole('region', { name: '요청했어요!' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /이웃에게 알리기/ })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: '내 요청' })).toBeInTheDocument();
  });

  it('불러오는 동안에는 로딩 문구를 보여준다', () => {
    vi.spyOn(myRequestService, 'listMyRequests').mockReturnValue(
      new Promise<MyRequest[]>(() => {}),
    );
    renderApp(['/resident/requests']);

    expect(screen.getByRole('status')).toHaveTextContent('불러오는 중이에요.');
  });

  it('불러오기에 실패하면 안내를 보여준다', async () => {
    vi.spyOn(myRequestService, 'listMyRequests').mockRejectedValue(new Error('network'));
    renderApp(['/resident/requests']);

    expect(await screen.findByText('요청을 가져오지 못했어요')).toBeInTheDocument();
  });
});

describe('이웃에게 알리기', () => {
  const shareButton = () => screen.getByRole('button', { name: '이웃에게 알리기 (링크 공유)' });

  it('Web Share 를 지원하면 가장 최근 요청의 요약 문장과 임시 링크로 공유한다', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    stub('share', share);
    const user = userEvent.setup();
    await requestSubmitter.submit(fruitRequest());
    await openMyRequests();

    await user.click(shareButton());

    expect(share).toHaveBeenCalledTimes(1);
    expect(share).toHaveBeenCalledWith({ text: FRUIT_SUMMARY, url: `${window.location.origin}/` });
    expect(screen.queryByText('링크를 복사했어요')).not.toBeInTheDocument();
  });

  it('지원하지 않으면 링크를 복사하고 "링크를 복사했어요"를 aria-live 로 알린다', async () => {
    const user = userEvent.setup();
    await openMyRequests();
    const writeText = vi.fn().mockResolvedValue(undefined);
    stub('clipboard', { writeText });

    await user.click(shareButton());

    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/`);
    const notice = await screen.findByText('링크를 복사했어요');
    expect(notice).toHaveAttribute('aria-live', 'polite');
  });

  it('공유를 취소하면 아무 문구도 띄우지 않는다', async () => {
    stub('share', vi.fn().mockRejectedValue(new DOMException('canceled', 'AbortError')));
    const user = userEvent.setup();
    await openMyRequests();

    await user.click(shareButton());

    await waitFor(() => expect(shareButton()).toBeEnabled());
    expect(screen.queryByText('링크를 복사했어요')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('복사에도 실패하면 오류 문구를 보여준다', async () => {
    const user = userEvent.setup();
    await openMyRequests();
    stub('clipboard', { writeText: vi.fn().mockRejectedValue(new Error('denied')) });

    await user.click(shareButton());

    expect(await screen.findByRole('alert')).toHaveTextContent('공유하지 못했어요');
  });

  it('서비스 이름은 공유 문구에 넣지 않는다', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    stub('share', share);
    const user = userEvent.setup();
    await openMyRequests();

    await user.click(shareButton());

    expect(JSON.stringify(share.mock.calls)).not.toContain('생기면');
  });
});

describe('요청 삭제(선택 후 삭제 + 확인창)', () => {
  const trash = () => screen.getByRole('button', { name: '선택한 요청 지우기' });
  const check = (index: number) => within(cards()[index]!).getByRole('checkbox');
  const dialog = () => screen.getByRole('dialog');
  const confirmButton = () => within(dialog()).getByRole('button', { name: /^지우기/ });
  const cancelButton = () => within(dialog()).getByRole('button', { name: '취소' });
  const FAILED = '일부 요청을 지우지 못했어요. 다시 시도해 주세요.';

  /** 과일 요청을 하나 더 만들어 카드를 2개(과일, 반찬) 둔다. */
  async function openWithTwo() {
    await requestSubmitter.submit(fruitRequest());
    await openMyRequests();
  }

  /** 아직 끝나지 않는 삭제 호출. release 로 끝낸다. */
  function pendingDelete() {
    const release: { resolve: () => void } = { resolve: () => {} };
    const spy = vi.spyOn(myRequestService, 'deleteRequest').mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          release.resolve = resolve;
        }),
    );
    return { spy, release };
  }

  it('목록 위에 "요청 선택하기" 줄과 휴지통이 있고, 선택이 없으면 휴지통이 비활성이다', async () => {
    await openMyRequests();

    expect(listSection().getByText('요청 선택하기')).toBeInTheDocument();
    expect(trash()).toBeDisabled();
    expect(check(0)).not.toBeChecked();
  });

  it('체크를 누르면 선택되고 다시 누르면 해제되며, 선택이 있으면 휴지통이 켜진다', async () => {
    const user = userEvent.setup();
    await openMyRequests();

    await user.click(check(0));
    expect(check(0)).toBeChecked();
    expect(trash()).toBeEnabled();

    await user.click(check(0));
    expect(check(0)).not.toBeChecked();
    expect(trash()).toBeDisabled();
  });

  it('체크의 이름에 동네와 업종이 들어 있다', async () => {
    await openMyRequests();

    expect(
      within(cards()[0]!).getByRole('checkbox', { name: '구성동 반찬가게 요청 선택' }),
    ).toBeInTheDocument();
  });

  it('여러 개를 고를 수 있다', async () => {
    const user = userEvent.setup();
    await openWithTwo();

    await user.click(check(0));
    await user.click(check(1));

    expect(check(0)).toBeChecked();
    expect(check(1)).toBeChecked();
  });

  it('하나를 고르고 휴지통을 누르면 확인창이 뜬다: 제목, 인원이 하나 줄어든다는 본문, 취소·지우기', async () => {
    const user = userEvent.setup();
    await openMyRequests();
    await user.click(check(0));

    await user.click(trash());

    const box = within(dialog());
    expect(dialog()).toHaveAttribute('aria-modal', 'true');
    expect(box.getByRole('heading', { name: '이 요청을 지울까요?' })).toBeInTheDocument();
    // 시드: 구성동 반찬 12명 → 11명
    expect(
      box.getByText('구성동 반찬 요청이 11명으로 줄어요. 지운 요청은 되돌릴 수 없어요.'),
    ).toBeInTheDocument();
    expect(box.getByRole('button', { name: '취소' })).toBeInTheDocument();
    expect(box.getByRole('button', { name: '지우기' })).toBeInTheDocument();
    expect(dialog()).toHaveAccessibleName('이 요청을 지울까요?');
    expect(dialog()).toHaveAccessibleDescription(/11명으로 줄어요/);
  });

  it('확인창이 열리면 제목에 포커스가 있고, 닫으면 포커스가 열기 전 자리로 돌아간다', async () => {
    const user = userEvent.setup();
    await openMyRequests();
    await user.click(check(0));
    trash().focus();

    await user.click(trash());
    expect(within(dialog()).getByRole('heading')).toHaveFocus();

    await user.click(cancelButton());
    expect(trash()).toHaveFocus();
  });

  it('인원이 0 이면 "0명으로 줄어요"(음수가 되지 않는다)', async () => {
    const user = userEvent.setup();
    const [seed] = await myRequestService.listMyRequests();
    vi.spyOn(myRequestService, 'listMyRequests').mockResolvedValue([{ ...seed!, requestCount: 0 }]);
    await openMyRequests();
    await user.click(check(0));

    await user.click(trash());

    expect(within(dialog()).getByText(/0명으로 줄어요/)).toBeInTheDocument();
    expect(within(dialog()).queryByText(/-1명/)).not.toBeInTheDocument();
  });

  it('둘 이상 고르면 임시 문구: "선택한 요청 N개를 지울까요?" / "지운 요청은 되돌릴 수 없어요."', async () => {
    const user = userEvent.setup();
    await openWithTwo();
    await user.click(check(0));
    await user.click(check(1));

    await user.click(trash());

    const box = within(dialog());
    expect(box.getByRole('heading', { name: '선택한 요청 2개를 지울까요?' })).toBeInTheDocument();
    expect(box.getByText('지운 요청은 되돌릴 수 없어요.')).toBeInTheDocument();
  });

  it('"취소"를 누르면 확인창만 닫히고 목록과 선택은 그대로다', async () => {
    const user = userEvent.setup();
    await openWithTwo();
    await user.click(check(0));
    await user.click(trash());

    await user.click(cancelButton());

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(cards()).toHaveLength(2);
    expect(check(0)).toBeChecked();
  });

  it('Escape 로 닫는다', async () => {
    const user = userEvent.setup();
    await openMyRequests();
    await user.click(check(0));
    await user.click(trash());

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(cards()).toHaveLength(1);
  });

  it('뒤 배경을 누르면 닫히지만 확인창 안을 누르면 닫히지 않는다', async () => {
    const user = userEvent.setup();
    await openMyRequests();
    await user.click(check(0));
    await user.click(trash());

    await user.click(within(dialog()).getByRole('heading'));
    expect(dialog()).toBeInTheDocument();

    await user.click(dialog().parentElement!);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('Tab 은 확인창 안에서만 돈다', async () => {
    const user = userEvent.setup();
    await openMyRequests();
    await user.click(check(0));
    await user.click(trash());

    await user.tab();
    expect(cancelButton()).toHaveFocus();
    await user.tab();
    expect(confirmButton()).toHaveFocus();
    await user.tab();
    expect(cancelButton()).toHaveFocus();
    await user.tab({ shift: true });
    expect(confirmButton()).toHaveFocus();
  });

  it('"지우기"를 누르면 그 요청이 목록에서 빠지고 확인창이 닫히며 선택이 비워진다', async () => {
    const user = userEvent.setup();
    await openWithTwo();
    await user.click(check(0));
    await user.click(trash());

    await user.click(confirmButton());

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(cards()).toHaveLength(1);
    expect(within(cards()[0]!).getByRole('heading', { name: '반찬가게' })).toBeInTheDocument();
    expect(check(0)).not.toBeChecked();
    expect(trash()).toBeDisabled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    // 목 서비스에서도 지워졌다(다시 불러와도 없다).
    expect((await myRequestService.listMyRequests()).map((i) => i.category.id)).toEqual([
      'side-dish',
    ]);
  });

  it('여러 개를 한 번에 지울 수 있고, 모두 지우면 빈 상태가 나온다', async () => {
    const user = userEvent.setup();
    await openWithTwo();
    await user.click(check(0));
    await user.click(check(1));
    await user.click(trash());

    await user.click(confirmButton());

    expect(await screen.findByText('아직 보낸 요청이 없어요')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '가게 요청하기' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: '요청했어요!' })).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('요청마다 각각 삭제를 호출한다', async () => {
    const user = userEvent.setup();
    const spy = vi.spyOn(myRequestService, 'deleteRequest');
    await openWithTwo();
    const ids = cards().map((_, index) => index);
    await user.click(check(ids[0]!));
    await user.click(check(ids[1]!));
    await user.click(trash());

    await user.click(confirmButton());

    await waitFor(() => expect(spy).toHaveBeenCalledTimes(2));
    expect(new Set(spy.mock.calls.map(([id]) => id)).size).toBe(2);
  });

  it('일부만 실패하면 성공한 것만 빠지고, 확인창은 닫히고, 임시 문구가 목록 위에 나오며 실패한 요청은 선택된 채 남는다', async () => {
    const user = userEvent.setup();
    await openWithTwo();
    const [fruitId, sideDishId] = cards().map((_, i) => i); // 화면 순서: 과일(최근), 반찬
    const items = await myRequestService.listMyRequests();
    const failingId = items[1]!.request.id; // 반찬
    const original = myRequestService.deleteRequest.bind(myRequestService);
    vi.spyOn(myRequestService, 'deleteRequest').mockImplementation(async (id) => {
      if (id === failingId) throw new Error('boom');
      await original(id);
    });
    await user.click(check(fruitId!));
    await user.click(check(sideDishId!));
    await user.click(trash());

    await user.click(confirmButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(FAILED);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(cards()).toHaveLength(1);
    expect(within(cards()[0]!).getByRole('heading', { name: '반찬가게' })).toBeInTheDocument();
    expect(check(0)).toBeChecked();
    expect(trash()).toBeEnabled();
  });

  it('전부 실패해도 같은 문구가 나오고 목록은 그대로다', async () => {
    const user = userEvent.setup();
    vi.spyOn(myRequestService, 'deleteRequest').mockRejectedValue(new Error('boom'));
    await openMyRequests();
    await user.click(check(0));
    await user.click(trash());

    await user.click(confirmButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(FAILED);
    expect(cards()).toHaveLength(1);
  });

  it('실패 문구는 다시 고르면 사라진다', async () => {
    const user = userEvent.setup();
    vi.spyOn(myRequestService, 'deleteRequest').mockRejectedValue(new Error('boom'));
    await openMyRequests();
    await user.click(check(0));
    await user.click(trash());
    await user.click(confirmButton());
    await screen.findByRole('alert');

    await user.click(check(0));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('삭제하는 동안 지우기·취소·휴지통·체크를 막고 호출은 한 번만 보낸다', async () => {
    const user = userEvent.setup();
    const { spy, release } = pendingDelete();
    await openMyRequests();
    await user.click(check(0));
    await user.click(trash());

    await user.click(confirmButton());
    await user.click(confirmButton());
    await user.dblClick(confirmButton());

    expect(spy).toHaveBeenCalledTimes(1);
    expect(confirmButton()).toHaveAttribute('aria-busy', 'true');
    expect(cancelButton()).toBeDisabled();
    expect(trash()).toBeDisabled();
    expect(check(0)).toBeDisabled();

    // 진행 중에는 Escape·배경 클릭으로도 닫히지 않는다.
    await user.keyboard('{Escape}');
    await user.click(dialog().parentElement!);
    expect(dialog()).toBeInTheDocument();

    release.resolve();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('같은 순간에 두 번 눌러도(화면이 다시 그려지기 전) 호출은 한 번만 보낸다', async () => {
    const user = userEvent.setup();
    const { spy, release } = pendingDelete();
    await openMyRequests();
    await user.click(check(0));
    await user.click(trash());

    const button = confirmButton();
    act(() => {
      button.click();
      button.click();
    });

    expect(spy).toHaveBeenCalledTimes(1);
    release.resolve();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('삭제가 끝나면 막았던 체크가 다시 눌린다', async () => {
    const user = userEvent.setup();
    const { release } = pendingDelete();
    await openWithTwo();
    await user.click(check(0));
    await user.click(trash());
    await user.click(confirmButton());
    expect(check(1)).toBeDisabled();

    release.resolve();

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(check(0)).toBeEnabled();
  });

  it('지운 뒤 요약 카드는 남은 가장 최근 요청을 기준으로 바뀐다', async () => {
    const user = userEvent.setup();
    await openWithTwo();
    expect(within(summaryCard()).getByText(FRUIT_SUMMARY)).toBeInTheDocument();
    await user.click(check(0)); // 과일(가장 최근)
    await user.click(trash());

    await user.click(confirmButton());

    await waitFor(() =>
      expect(within(summaryCard()).getByText(SIDE_DISH_SUMMARY)).toBeInTheDocument(),
    );
  });
});
