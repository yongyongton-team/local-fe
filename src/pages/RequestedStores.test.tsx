import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/services/api/apiError';
import {
  authService,
  DEMO_WRITE_BLOCKED_MESSAGE,
  demandService,
  myRequestService,
  requestSubmitter,
} from '@/services';
import { renderApp } from '@/test/renderApp';

/** 주민 탐색의 "주민이 요청한 가게". 목 서비스를 쓰고 네트워크는 없다. */
async function openResident(neighborhoodId = 'guseong') {
  const user = userEvent.setup();
  const view = renderApp();
  await screen.findByRole('option', { name: '기흥구 구성동' });
  await user.selectOptions(screen.getByLabelText('내 동네'), neighborhoodId);
  await user.click(screen.getByRole('radio', { name: /^주민/ }));
  await user.click(screen.getByRole('button', { name: '시작하기' }));
  await screen.findByRole('region', { name: '동네 지도(예시)' });
  await screen.findByRole('heading', { level: 2, name: '우리 동네에 없는 가게' });
  // 지도 응답이 도착해 마커가 그려질 때까지(요청한 가게 섹션도 같은 응답에서 나온다)
  await waitFor(() =>
    expect(
      within(screen.getByRole('region', { name: '동네 지도(예시)' })).queryAllByRole('listitem')
        .length,
    ).toBeGreaterThan(0),
  );
  return { user, ...view };
}

const sectionHeading = () =>
  screen.queryByRole('heading', { level: 2, name: '주민이 요청한 가게' });
const section = () => within(sectionHeading()!.closest('section')!);
const items = () => section().getAllByRole('listitem');
const dialog = () => screen.getByRole('dialog');
const missingSection = () =>
  screen.getByRole('heading', { level: 2, name: '우리 동네에 없는 가게' }).closest('section')!;

async function fillVisit(user: ReturnType<typeof userEvent.setup>) {
  await user.click(within(dialog()).getByRole('button', { name: '평일 저녁' }));
  await user.click(within(dialog()).getByRole('radio', { name: '주 1번 이상' }));
}

afterEach(() => vi.restoreAllMocks());

describe('주민이 요청한 가게: 목록', () => {
  it('요청은 있고 gaps 와 겹치지 않는 업종(반찬 12명, 빵 6명)만 요청 많은 순으로 나온다', async () => {
    await openResident();

    expect(sectionHeading()).toBeInTheDocument();
    expect(items()).toHaveLength(2);
    expect(items()[0]).toHaveTextContent('반찬가게');
    expect(items()[0]).toHaveTextContent('주민 12명이 요청');
    expect(items()[1]).toHaveTextContent('빵집');
    expect(items()[1]).toHaveTextContent('주민 6명이 요청');
    // gap 인 과일/채소 는 이 목록에 없다.
    expect(section().queryByText('과일 / 채소 가게')).not.toBeInTheDocument();
  });

  it('"우리 동네에 없는 가게" 목록 아래에 있다', async () => {
    await openResident();

    const position = missingSection().compareDocumentPosition(
      sectionHeading()!.closest('section')!,
    );
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('요청한 가게가 하나도 없으면(마북동) 섹션 전체가 없다', async () => {
    await openResident('mabuk');

    expect(sectionHeading()).not.toBeInTheDocument();
    expect(screen.queryByText('다른 주민도 요청했어요 · 요청 많은 순')).not.toBeInTheDocument();
  });

  it('다른 동네(보정동)는 그 동네의 요청 업종(과일 14명)을 보여준다', async () => {
    await openResident('bojeong');

    expect(items()).toHaveLength(1);
    expect(items()[0]).toHaveTextContent('과일 / 채소 가게');
    expect(items()[0]).toHaveTextContent('주민 14명이 요청');
  });
});

describe('주민이 요청한 가게: ✓ 표시', () => {
  it('내 요청(GET /me/requests)에 같은 동네·업종이 있으면 ✓, 없으면 「나도 요청」 버튼이다', async () => {
    await openResident();

    await waitFor(() =>
      expect(within(items()[0]!).getByRole('link', { name: '내 요청 보기' })).toBeInTheDocument(),
    );
    expect(
      within(items()[0]!).queryByRole('button', { name: '나도 요청' }),
    ).not.toBeInTheDocument();
    expect(within(items()[1]!).getByRole('button', { name: '나도 요청' })).toBeInTheDocument();
    expect(
      within(items()[1]!).queryByRole('link', { name: '내 요청 보기' }),
    ).not.toBeInTheDocument();
  });

  it('내 요청을 불러오지 못해도 목록은 그대로이고 ✓ 만 없다(오류 안내 없음)', async () => {
    vi.spyOn(myRequestService, 'listMyRequests').mockRejectedValue(
      new ApiError({ kind: 'http', status: 403, code: 'FORBIDDEN', message: 'x' }),
    );
    await openResident();

    expect(items()).toHaveLength(2);
    expect(within(items()[0]!).getByRole('button', { name: '나도 요청' })).toBeInTheDocument();
    expect(within(items()[1]!).getByRole('button', { name: '나도 요청' })).toBeInTheDocument();
    expect(screen.queryByText('요청을 가져오지 못했어요')).not.toBeInTheDocument();
    expect(screen.queryByText(/역할이 아니에요/)).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('주민이 요청한 가게: 나도 요청', () => {
  it('「나도 요청」을 누르면 그 동네·업종으로 기존 요청 창이 열린다', async () => {
    const { user } = await openResident();

    await user.click(within(items()[1]!).getByRole('button', { name: '나도 요청' }));

    expect(dialog()).toHaveAccessibleName('나도 요청');
    expect(within(dialog()).getByText('구성동 · 빵집')).toBeInTheDocument();
  });

  it('보내면 {동, 업종, 시간대, 빈도}로 제출하고 그 항목이 ✓ 가 되며 요청 수가 즉시 +1 이다(지도 알약도 함께)', async () => {
    const submit = vi.spyOn(requestSubmitter, 'submitQuick');
    const listMap = vi.spyOn(demandService, 'getMapOverview');
    const { user } = await openResident();
    await user.click(within(items()[1]!).getByRole('button', { name: '나도 요청' }));
    await fillVisit(user);

    await user.click(within(dialog()).getByRole('button', { name: /^보내기/ }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(submit).toHaveBeenCalledWith({
      neighborhoodId: 'guseong',
      categoryId: 'bakery',
      visitTimes: ['weekday-evening'],
      visitFrequency: 'weekly',
    });
    expect(within(items()[1]!).getByRole('link', { name: '내 요청 보기' })).toBeInTheDocument();
    expect(
      within(items()[1]!).queryByRole('button', { name: '나도 요청' }),
    ).not.toBeInTheDocument();
    // 숫자가 바로 올라간다: 6명 → 7명.
    expect(items()[1]).toHaveTextContent('주민 7명이 요청');
    expect(items()[1]).not.toHaveTextContent('주민 6명이 요청');
    // "없는 가게" 카드와 같은 방식이라 지도의 같은 업종 알약도 함께 올라간다.
    const map = within(screen.getByRole('region', { name: '동네 지도(예시)' }));
    expect(map.getByText('빵 요청 7')).toBeInTheDocument();
    expect(map.queryByText('빵 요청 6')).not.toBeInTheDocument();
    // 다른 항목은 그대로다(반찬 12명, ✓ 는 처음부터).
    expect(items()[0]).toHaveTextContent('주민 12명이 요청');
    // 지도 응답을 다시 부르지 않는다.
    expect(listMap).toHaveBeenCalledTimes(1);
  });

  it('이미 ✓ 인 항목(내 요청에 있는 반찬)은 「나도 요청」이 없어 숫자를 올릴 수 없다', async () => {
    await openResident();

    await waitFor(() =>
      expect(within(items()[0]!).getByRole('link', { name: '내 요청 보기' })).toBeInTheDocument(),
    );
    expect(within(items()[0]!).queryByRole('button')).not.toBeInTheDocument();
    expect(items()[0]).toHaveTextContent('주민 12명이 요청');
  });

  it('한 번 보낸 항목은 +1 이 한 번만 반영되고 버튼이 사라져 다시 보낼 수 없다', async () => {
    const submit = vi.spyOn(requestSubmitter, 'submitQuick');
    const { user } = await openResident();
    await user.click(within(items()[1]!).getByRole('button', { name: '나도 요청' }));
    await fillVisit(user);
    await user.click(within(dialog()).getByRole('button', { name: /^보내기/ }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    expect(items()[1]).toHaveTextContent('주민 7명이 요청');
    expect(
      within(items()[1]!).queryByRole('button', { name: '나도 요청' }),
    ).not.toBeInTheDocument();
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it('409 ALREADY_REQUESTED 이면 기존 안내 문구를 보이고 그 항목이 ✓ 가 된다', async () => {
    vi.spyOn(requestSubmitter, 'submitQuick').mockRejectedValue(
      new ApiError({
        kind: 'http',
        status: 409,
        code: 'ALREADY_REQUESTED',
        message: '서버 원문',
      }),
    );
    const { user } = await openResident();
    await user.click(within(items()[1]!).getByRole('button', { name: '나도 요청' }));
    await fillVisit(user);

    await user.click(within(dialog()).getByRole('button', { name: /^보내기/ }));

    expect(await within(dialog()).findByRole('alert')).toHaveTextContent(
      '이 동네에 같은 업종을 이미 요청했어요. 내 요청에서 확인해 보세요.',
    );
    expect(screen.queryByText(/서버 원문/)).not.toBeInTheDocument();
    await user.click(within(dialog()).getByRole('button', { name: '확인' }));
    expect(within(items()[1]!).getByRole('link', { name: '내 요청 보기' })).toBeInTheDocument();
    // 이미 세어진 요청이라 숫자는 그대로다(알약도 그대로).
    expect(items()[1]).toHaveTextContent('주민 6명이 요청');
    expect(
      within(screen.getByRole('region', { name: '동네 지도(예시)' })).getByText('빵 요청 6'),
    ).toBeInTheDocument();
  });

  it('다른 오류는 창 안에 문구를 보이고 ✓ 는 붙지 않는다', async () => {
    vi.spyOn(requestSubmitter, 'submitQuick').mockRejectedValue(
      new ApiError({ kind: 'network', message: 'x' }),
    );
    const { user } = await openResident();
    await user.click(within(items()[1]!).getByRole('button', { name: '나도 요청' }));
    await fillVisit(user);

    await user.click(within(dialog()).getByRole('button', { name: /^보내기/ }));

    expect(await within(dialog()).findByRole('alert')).toHaveTextContent(
      '네트워크 연결을 확인하고 다시 시도해 주세요.',
    );
    await user.click(within(dialog()).getByRole('button', { name: '닫기' }));
    expect(within(items()[1]!).getByRole('button', { name: '나도 요청' })).toBeInTheDocument();
    // 실패하면 숫자도 그대로다.
    expect(items()[1]).toHaveTextContent('주민 6명이 요청');
  });

  it('데모 세션의 POST /requests 차단은 그대로다(요청 없이 데모 안내)', async () => {
    const submit = vi.spyOn(requestSubmitter, 'submitQuick');
    const { user } = await openResident();
    // 화면에 들어온 뒤 데모 세션이 된다(들어올 때의 역할 저장은 막지 않게 뒤에서 켠다).
    vi.spyOn(authService, 'isDemoSession').mockReturnValue(true);
    await user.click(within(items()[1]!).getByRole('button', { name: '나도 요청' }));
    await fillVisit(user);

    await user.click(within(dialog()).getByRole('button', { name: /^보내기/ }));

    expect(await within(dialog()).findByRole('alert')).toHaveTextContent(
      DEMO_WRITE_BLOCKED_MESSAGE,
    );
    expect(submit).not.toHaveBeenCalled();
    // 숫자도 ✓ 도 바뀌지 않는다.
    await user.click(within(dialog()).getByRole('button', { name: '닫기' }));
    expect(items()[1]).toHaveTextContent('주민 6명이 요청');
    expect(within(items()[1]!).getByRole('button', { name: '나도 요청' })).toBeInTheDocument();
  });

  it('"없는 가게" 카드의 「나도 요청」은 기존대로 인원이 +1 된다(변경 없음)', async () => {
    const { user } = await openResident();
    const missing = within(missingSection());
    const fruit = missing.getAllByRole('listitem')[0]!;
    expect(fruit).toHaveTextContent('주민 29명이 요청');

    await user.click(within(fruit).getByRole('button', { name: '나도 요청' }));
    await fillVisit(user);
    await user.click(within(dialog()).getByRole('button', { name: /^보내기/ }));

    await waitFor(() => expect(fruit).toHaveTextContent('주민 30명이 요청'));
  });
});
