import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { authService, DEMO_WRITE_BLOCKED_MESSAGE, requestSubmitter } from '@/services';
import { ApiError } from '@/services/api/apiError';
import { renderApp } from '@/test/renderApp';

/** 주민 탐색 카드의 "나도 요청"(간편 요청). 목 서비스를 쓰고 네트워크는 없다. */
async function openResident() {
  const user = userEvent.setup();
  const view = renderApp();
  await screen.findByRole('option', { name: '기흥구 구성동' });
  await user.selectOptions(screen.getByLabelText('내 동네'), 'guseong');
  await user.click(screen.getByRole('radio', { name: /^주민/ }));
  await user.click(screen.getByRole('button', { name: '시작하기' }));
  await screen.findByRole('region', { name: '동네 지도(예시)' });
  await waitFor(() => expect(cards()).toHaveLength(3));
  return { user, ...view };
}

const cardSection = () =>
  within(
    screen.getByRole('heading', { level: 2, name: '우리 동네에 없는 가게' }).closest('section')!,
  );
const cards = () => cardSection().queryAllByRole('listitem');
/** 카드 순서: 과일(29명), 반찬(12명, 내가 요청함), 빵집(7명) */
const fruitCard = () => within(cards()[0]!);
const bakeryCard = () => within(cards()[2]!);
const dialog = () => screen.getByRole('dialog');
const sendButton = () => within(dialog()).getByRole('button', { name: /^보내기/ });
const mapPills = () =>
  within(screen.getByRole('region', { name: '동네 지도(예시)' }))
    .queryAllByRole('listitem')
    .map((li) => li.textContent ?? '');

async function fillVisit(user: ReturnType<typeof userEvent.setup>) {
  await user.click(within(dialog()).getByRole('button', { name: '평일 저녁' }));
  await user.click(within(dialog()).getByRole('radio', { name: '주 1번 이상' }));
}

afterEach(() => vi.restoreAllMocks());

describe('나도 요청: 카드의 아이콘', () => {
  it('내가 요청하지 않은 카드의 사람+ 를 누르면 그 업종의 요청 창이 열린다', async () => {
    const { user } = await openResident();

    await user.click(fruitCard().getByRole('button', { name: '나도 요청' }));

    expect(dialog()).toHaveAccessibleName('나도 요청');
    expect(dialog()).toHaveAttribute('aria-modal', 'true');
    // 어떤 요청에 대한 창인지: 동 이름과 업종 이름
    expect(within(dialog()).getByText('구성동 · 과일 / 채소 가게')).toBeInTheDocument();
  });

  it('내가 요청한 카드의 사람✓ 를 누르면 내 요청 화면으로 이동한다', async () => {
    const { user, router } = await openResident();

    await user.click(within(cards()[1]!).getByRole('link', { name: '내 요청 보기' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/resident/requests'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('나도 요청: 요청 창', () => {
  it('열릴 때 제목에 포커스가 가고, 문장 입력이나 AI 정리는 없다', async () => {
    const { user } = await openResident();

    await user.click(fruitCard().getByRole('button', { name: '나도 요청' }));

    expect(within(dialog()).getByRole('heading', { name: '나도 요청' })).toHaveFocus();
    expect(within(dialog()).queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('시간대·빈도를 고르기 전에는 보내기가 비활성이고 안내가 보이며, 둘 다 고르면 활성이 된다', async () => {
    const { user } = await openResident();
    await user.click(fruitCard().getByRole('button', { name: '나도 요청' }));
    expect(sendButton()).toBeDisabled();
    expect(within(dialog()).getByText('방문 시간대와 빈도를 골라 주세요.')).toBeInTheDocument();

    await user.click(within(dialog()).getByRole('button', { name: '평일 저녁' }));
    expect(sendButton()).toBeDisabled(); // 시간대만 고른 상태

    await user.click(within(dialog()).getByRole('radio', { name: '주 1번 이상' }));
    expect(sendButton()).toBeEnabled();
    expect(
      within(dialog()).queryByText('방문 시간대와 빈도를 골라 주세요.'),
    ).not.toBeInTheDocument();

    await user.click(within(dialog()).getByRole('button', { name: '평일 저녁' })); // 시간대를 다시 비우면
    expect(sendButton()).toBeDisabled();
  });

  it('보낸 내용은 {동, 업종, 시간대, 빈도}뿐이다(문장·조건 없음)', async () => {
    const submit = vi
      .spyOn(requestSubmitter, 'submitQuick')
      .mockResolvedValue({ reachedGoal: false });
    const { user } = await openResident();
    await user.click(bakeryCard().getByRole('button', { name: '나도 요청' }));
    await user.click(within(dialog()).getByRole('button', { name: '평일 저녁' }));
    await user.click(within(dialog()).getByRole('button', { name: '주말' }));
    await user.click(within(dialog()).getByRole('radio', { name: '한 달 2~3번' }));

    await user.click(sendButton());

    expect(submit).toHaveBeenCalledTimes(1);
    const [input] = submit.mock.calls[0]!;
    expect(input).toEqual({
      neighborhoodId: 'guseong',
      categoryId: 'bakery',
      visitTimes: ['weekday-evening', 'weekend'],
      visitFrequency: 'monthly',
    });
    expect(input).not.toHaveProperty('detail');
    expect(input).not.toHaveProperty('conditions');
  });

  it('보내는 동안 다시 눌러도(화면이 다시 그려지기 전) 요청은 한 번만 나가고 닫기는 막힌다', async () => {
    const gate: { release: () => void } = { release: () => {} };
    const submit = vi.spyOn(requestSubmitter, 'submitQuick').mockImplementation(
      () =>
        new Promise((resolve) => {
          gate.release = () => resolve({ reachedGoal: false });
        }),
    );
    const { user } = await openResident();
    await user.click(bakeryCard().getByRole('button', { name: '나도 요청' }));
    await fillVisit(user);
    const button = sendButton();

    await act(async () => {
      button.click();
      button.click();
    });
    await user.keyboard('{Escape}');

    expect(submit).toHaveBeenCalledTimes(1);
    expect(dialog()).toBeInTheDocument(); // 처리 중에는 Escape 로 닫히지 않는다
    expect(within(dialog()).getByRole('button', { name: '닫기' })).toBeDisabled();

    await act(async () => gate.release());
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it('×, Escape, 바깥 터치로 닫히고 아무것도 보내지 않는다', async () => {
    const submit = vi.spyOn(requestSubmitter, 'submitQuick');
    const { user } = await openResident();
    const open = () => user.click(fruitCard().getByRole('button', { name: '나도 요청' }));

    await open();
    await user.click(within(dialog()).getByRole('button', { name: '닫기' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await open();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await open();
    await user.click(dialog().parentElement!);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    expect(submit).not.toHaveBeenCalled();
    // 닫으면 포커스가 요청 버튼으로 돌아간다.
    expect(fruitCard().getByRole('button', { name: '나도 요청' })).toHaveFocus();
    expect(fruitCard().getByText(/주민 29명이 요청/)).toBeInTheDocument();
  });

  it('Tab 은 요청 창 안에서만 돈다', async () => {
    const { user } = await openResident();
    await user.click(fruitCard().getByRole('button', { name: '나도 요청' }));

    const focusables = () => [
      ...dialog().querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled])'),
    ];
    for (let i = 0; i < focusables().length + 2; i += 1) {
      await user.tab();
      expect(dialog().contains(document.activeElement)).toBe(true);
    }
  });
});

describe('나도 요청: 성공', () => {
  it('기준 인원에 도달하지 않으면 창이 닫히고 카드의 숫자가 +1, 아이콘이 ✓ 로 바뀐다', async () => {
    const { user } = await openResident();
    expect(bakeryCard().getByText(/주민 6명이 요청/)).toBeInTheDocument();
    await user.click(bakeryCard().getByRole('button', { name: '나도 요청' }));
    await fillVisit(user);

    await user.click(sendButton());

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(bakeryCard().getByText(/주민 7명이 요청/)).toBeInTheDocument();
    expect(bakeryCard().getByRole('link', { name: '내 요청 보기' })).toBeInTheDocument();
    expect(bakeryCard().queryByRole('button', { name: '나도 요청' })).not.toBeInTheDocument();
    // 다른 카드는 그대로다.
    expect(fruitCard().getByText(/주민 29명이 요청/)).toBeInTheDocument();
  });

  it('지도의 "요청 N" 알약 숫자도 함께 바뀐다', async () => {
    const { user } = await openResident();
    expect(mapPills()).toContain('과일 요청 29');
    await user.click(fruitCard().getByRole('button', { name: '나도 요청' }));
    await fillVisit(user);

    await user.click(sendButton());
    await screen.findByText('30명이 모였어요!');

    expect(mapPills()).toContain('과일 요청 30');
    expect(mapPills()).not.toContain('과일 요청 29');
  });

  it('29 → 30명이 되면(reachedGoal) 창 안에 "30명이 모였어요!"와 알린 사장님 수를 보여주고, 카드도 갱신한다', async () => {
    const { user } = await openResident();
    await user.click(fruitCard().getByRole('button', { name: '나도 요청' }));
    await fillVisit(user);

    await user.click(sendButton());

    expect(await screen.findByText('30명이 모였어요!')).toBeInTheDocument();
    expect(within(dialog()).getByText(/^근처 사장님 \d+명에게 알렸어요$/)).toBeInTheDocument();
    expect(fruitCard().getByText(/주민 30명이 요청/)).toBeInTheDocument();
    expect(fruitCard().getByRole('link', { name: '내 요청 보기' })).toBeInTheDocument();

    await user.click(within(dialog()).getByRole('button', { name: '확인' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('알린 사장님 수가 있으면 그 숫자로 보여준다', async () => {
    vi.spyOn(requestSubmitter, 'submitQuick').mockResolvedValue({
      reachedGoal: true,
      notifiedOwnerCount: 3,
    });
    const { user } = await openResident();
    await user.click(fruitCard().getByRole('button', { name: '나도 요청' }));
    await fillVisit(user);

    await user.click(sendButton());

    expect(await screen.findByText('30명이 모였어요!')).toBeInTheDocument();
    expect(within(dialog()).getByText('근처 사장님 3명에게 알렸어요')).toBeInTheDocument();
  });

  it('알린 사장님 수가 없으면 숫자 없이 앞 문장만 보여준다', async () => {
    vi.spyOn(requestSubmitter, 'submitQuick').mockResolvedValue({ reachedGoal: true });
    const { user } = await openResident();
    await user.click(fruitCard().getByRole('button', { name: '나도 요청' }));
    await fillVisit(user);

    await user.click(sendButton());

    expect(await screen.findByText('30명이 모였어요!')).toBeInTheDocument();
    expect(within(dialog()).queryByText(/근처 사장님/)).not.toBeInTheDocument();
  });

  it('보낸 요청은 내 요청 화면에 문장 없이 들어간다', async () => {
    const { user, router } = await openResident();
    await user.click(bakeryCard().getByRole('button', { name: '나도 요청' }));
    await fillVisit(user);
    await user.click(sendButton());
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await user.click(bakeryCard().getByRole('link', { name: '내 요청 보기' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/resident/requests'));
    expect(await screen.findByRole('heading', { level: 3, name: '빵집' })).toBeInTheDocument();
  });
});

describe('나도 요청: 실패와 차단', () => {
  it('409 ALREADY_REQUESTED 는 기존 안내 문구를 보여주고 카드를 ✓ 로 바꾼다(숫자는 그대로)', async () => {
    vi.spyOn(requestSubmitter, 'submitQuick').mockRejectedValue(
      new ApiError({
        kind: 'http',
        status: 409,
        code: 'ALREADY_REQUESTED',
        message: '서버 원문 노출 금지',
      }),
    );
    const { user } = await openResident();
    await user.click(bakeryCard().getByRole('button', { name: '나도 요청' }));
    await fillVisit(user);

    await user.click(sendButton());

    expect(await within(dialog()).findByRole('alert')).toHaveTextContent(
      '이 동네에 같은 업종을 이미 요청했어요. 내 요청에서 확인해 보세요.',
    );
    expect(screen.queryByText(/서버 원문/)).not.toBeInTheDocument();
    expect(bakeryCard().getByText(/주민 6명이 요청/)).toBeInTheDocument();
    expect(bakeryCard().getByRole('link', { name: '내 요청 보기' })).toBeInTheDocument();

    await user.click(within(dialog()).getByRole('button', { name: '확인' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('그 밖의 오류는 오류 종류별 문구만 보여주고(서버 message 는 쓰지 않는다) 창과 카드는 그대로다', async () => {
    vi.spyOn(requestSubmitter, 'submitQuick').mockRejectedValue(
      new ApiError({ kind: 'http', status: 500, code: 'X', message: '서버 원문 노출 금지' }),
    );
    const { user } = await openResident();
    await user.click(bakeryCard().getByRole('button', { name: '나도 요청' }));
    await fillVisit(user);

    await user.click(sendButton());

    expect(await within(dialog()).findByRole('alert')).toHaveTextContent(
      '일시적인 문제가 생겼어요. 잠시 후 다시 시도해 주세요.',
    );
    expect(screen.queryByText(/서버 원문/)).not.toBeInTheDocument();
    expect(bakeryCard().getByText(/주민 6명이 요청/)).toBeInTheDocument();
    expect(bakeryCard().getByRole('button', { name: '나도 요청' })).toBeInTheDocument();
    expect(sendButton()).toBeEnabled(); // 다시 보낼 수 있다
  });

  it('네트워크 오류는 연결 확인 문구를 보여준다', async () => {
    vi.spyOn(requestSubmitter, 'submitQuick').mockRejectedValue(
      new ApiError({ kind: 'network', message: 'x' }),
    );
    const { user } = await openResident();
    await user.click(bakeryCard().getByRole('button', { name: '나도 요청' }));
    await fillVisit(user);

    await user.click(sendButton());

    expect(await within(dialog()).findByRole('alert')).toHaveTextContent(
      '네트워크 연결을 확인하고 다시 시도해 주세요.',
    );
  });

  it('데모 세션에서는 서버로 보내지 않고 기존 데모 차단 문구를 보여준다', async () => {
    const submit = vi.spyOn(requestSubmitter, 'submitQuick');
    const { user } = await openResident();
    await user.click(bakeryCard().getByRole('button', { name: '나도 요청' }));
    await fillVisit(user);
    // 데모 세션이 된 상태(첫 화면 시작은 이미 지났다)에서 보낸다.
    vi.spyOn(authService, 'isDemoSession').mockReturnValue(true);

    await user.click(sendButton());

    expect(await within(dialog()).findByRole('alert')).toHaveTextContent(
      DEMO_WRITE_BLOCKED_MESSAGE,
    );
    expect(submit).not.toHaveBeenCalled();
    expect(bakeryCard().getByText(/주민 6명이 요청/)).toBeInTheDocument();
  });
});
