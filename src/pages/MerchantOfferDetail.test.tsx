import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getDb } from '@/mocks/memoryDb';
import { authService, offerService } from '@/services';
import { ApiError } from '@/services/api/apiError';
import { renderApp } from '@/test/renderApp';
import type { OfferStatus, OwnerOffer } from '@/types/domain';

const heading1 = (name: string) => screen.findByRole('heading', { level: 1, name });
const dialog = () => screen.getByRole('dialog');
const actionButton = (name: string) => screen.getByRole('button', { name });
const queryAction = (name: string) => screen.queryByRole('button', { name });
const COMPLETE = '판매 끝 (모두 받아 갔어요)';
const CANCEL = '제안 취소';

/** 상태별 제안을 메모리 DB 에 직접 만든다(CLOSED·CANCELLED·DONE 화면용). */
function addOffer(status: OfferStatus, overrides: Partial<OwnerOffer> = {}): OwnerOffer {
  const offer: OwnerOffer = {
    id: `t-${status}`,
    title: `테스트 ${status}`,
    status,
    price: 10000,
    pickupAt: new Date('2026-11-20T10:00:00+09:00'),
    pickupPlace: '테스트 장소',
    dongName: '구성동',
    deadlineAt: new Date('2026-11-18T18:00:00+09:00'),
    orderCount: 5,
    minOrders: 20,
    ...overrides,
  };
  getDb().offers.push(offer);
  return offer;
}

async function openDetail(id: string) {
  const view = renderApp([`/merchant/offers/${id}`]);
  await heading1('제안 상세');
  await screen.findByRole('region', { name: '예약 현황' });
  return view;
}
const card = () => within(screen.getByRole('region', { name: '예약 현황' }));
const bar = () => card().getByRole('progressbar');

afterEach(() => vi.restoreAllMocks());

describe('제안 상세: 진입', () => {
  it('내 가게 목록의 제안 카드를 누르면 그 제안의 상세로 간다(카드는 링크다)', async () => {
    const user = userEvent.setup();
    const { router } = renderApp(['/merchant/offers']);

    const link = await screen.findByRole('link', { name: '제철 과일 꾸러미' });
    expect(link).toHaveAttribute('href', '/merchant/offers/offer-seed-1');
    await user.click(link);

    expect(await heading1('제안 상세')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/merchant/offers/offer-seed-1');
    expect(
      await screen.findByRole('heading', { level: 2, name: '제철 과일 꾸러미' }),
    ).toBeInTheDocument();
  });

  it('뒤로 가기는 목록으로 돌아간다', async () => {
    const user = userEvent.setup();
    const { router } = renderApp(['/merchant/offers']);
    await user.click(await screen.findByRole('link', { name: '제철 과일 꾸러미' }));
    await heading1('제안 상세');

    await user.click(screen.getByRole('button', { name: '뒤로 가기' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/merchant/offers'));
  });

  it('주소로 바로 들어와도(이전 화면 없음) 목록으로 가는 뒤로 가기가 있다', async () => {
    const user = userEvent.setup();
    const { router } = await openDetail('offer-seed-1');

    await user.click(screen.getByRole('button', { name: '뒤로 가기' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/merchant/offers'));
  });

  it('없는 id 면 "찾을 수 없는 제안" 안내와 목록 링크가 보이고 버튼은 없다', async () => {
    renderApp(['/merchant/offers/nope']);

    expect(await screen.findByText('찾을 수 없는 제안이에요')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '제안 목록으로' })).toHaveAttribute(
      'href',
      '/merchant/offers',
    );
    expect(queryAction(COMPLETE)).not.toBeInTheDocument();
    expect(queryAction(CANCEL)).not.toBeInTheDocument();
  });

  it('제안 목록을 불러오지 못하면 오류 안내이고 서버 원문은 보이지 않는다', async () => {
    vi.spyOn(offerService, 'getOwnerOffer').mockRejectedValue(new Error('서버 원문'));
    renderApp(['/merchant/offers/offer-seed-1']);

    expect(await screen.findByText('제안을 가져오지 못했어요')).toBeInTheDocument();
    expect(screen.getByText('잠시 후 다시 시도해 주세요.')).toBeInTheDocument();
    expect(screen.queryByText(/서버 원문/)).not.toBeInTheDocument();
  });
});

describe('제안 상세: 상태별 화면', () => {
  it('OPEN: 뱃지·마감·제목·동네·업종·예약 현황·받는 날·받는 곳, 버튼은 「제안 취소」뿐이다', async () => {
    await openDetail('offer-seed-1');

    expect(screen.getByText('모집 중')).toBeInTheDocument();
    expect(screen.getByText('마감 11/14(토) 18:00')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: '제철 과일 꾸러미' })).toBeInTheDocument();
    expect(await screen.findByText('구성동 · 과일 가게')).toBeInTheDocument();
    expect(card().getByText('예약 0명 · 최소 20명')).toBeInTheDocument();
    expect(
      card().getByText('마감(11/14(토) 18:00)까지 20명이 모이면 확정돼요'),
    ).toBeInTheDocument();
    expect(card().getByText('받는 날').nextElementSibling).toHaveTextContent(
      '11/15(일) 오전 10:00',
    );
    expect(card().getByText('받는 곳').nextElementSibling).toHaveTextContent('구성동 주민센터 앞');
    expect(queryAction(COMPLETE)).not.toBeInTheDocument();
    expect(actionButton(CANCEL)).toBeInTheDocument();
  });

  it('CONFIRMED: 뱃지 "확정", 시안 문구, 막대 가득, 판매 끝과 제안 취소 둘 다 있다', async () => {
    await openDetail('offer-seed-2');

    expect(screen.getByText('확정')).toBeInTheDocument();
    expect(screen.getByText('보정동 · 과일 가게')).toBeInTheDocument();
    expect(card().getByText('예약 22명 · 최소 20명')).toBeInTheDocument();
    expect(card().getByText('최소 주문을 채워서 확정됐어요')).toBeInTheDocument();
    expect((bar().firstElementChild as HTMLElement).style.width).toBe('100%');
    expect(actionButton(COMPLETE)).toBeInTheDocument();
    expect(actionButton(CANCEL)).toBeInTheDocument();
  });

  it('OPEN 인데 인원이 이미 찼어도 "확정됐어요"라고 쓰지 않는다(서버는 마감 뒤에야 확정한다)', async () => {
    addOffer('OPEN', { id: 't-full', orderCount: 25 });
    await openDetail('t-full');

    expect(
      card().getByText('최소 인원을 채웠어요. 마감 시각이 지나면 확정돼요'),
    ).toBeInTheDocument();
    expect(card().queryByText(/확정됐어요/)).not.toBeInTheDocument();
    expect(screen.getByText('모집 중')).toBeInTheDocument();
    expect(queryAction(COMPLETE)).not.toBeInTheDocument();
  });

  it.each([
    ['CLOSED', '마감', '마감됐지만 최소 인원을 채우지 못했어요'],
    ['CANCELLED', '취소', '취소한 제안이에요'],
    ['DONE', '수령 끝', '수령이 끝난 제안이에요'],
  ] as const)('%s: 뱃지 "%s", 안내 문구, 버튼 없이 읽기 전용이다', async (status, badge, note) => {
    addOffer(status);
    await openDetail(`t-${status}`);

    expect(screen.getByText(badge, { selector: 'span' })).toBeInTheDocument();
    expect(card().getByText(note)).toBeInTheDocument();
    expect(queryAction(COMPLETE)).not.toBeInTheDocument();
    expect(queryAction(CANCEL)).not.toBeInTheDocument();
  });

  it('막대 비율은 예약 ÷ 최소 주문이고 초과하면 가득 찬다(aria 값은 그대로)', async () => {
    addOffer('OPEN', { id: 't-half', orderCount: 10 });
    addOffer('OPEN', { id: 't-over', orderCount: 30 });

    const { unmount } = await openDetail('t-half');
    expect((bar().firstElementChild as HTMLElement).style.width).toBe('50%');
    expect(bar()).toHaveAccessibleName('예약 10명 · 최소 20명');
    unmount();

    await openDetail('t-over');
    expect((bar().firstElementChild as HTMLElement).style.width).toBe('100%');
    expect(bar()).toHaveAttribute('aria-valuenow', '30');
    expect(bar()).toHaveAttribute('aria-valuemax', '20');
  });

  it('값이 비어 있으면 그 행·문구를 숨긴다(받는 날·받는 곳·마감·동네)', async () => {
    addOffer('OPEN', {
      id: 't-empty',
      pickupAt: undefined,
      pickupPlace: undefined,
      deadlineAt: undefined,
      dongName: undefined,
    });
    await openDetail('t-empty');

    expect(card().queryByText('받는 날')).not.toBeInTheDocument();
    expect(card().queryByText('받는 곳')).not.toBeInTheDocument();
    expect(screen.queryByText(/^마감 /)).not.toBeInTheDocument();
    // 동네가 없어도 업종은 보인다.
    expect(await screen.findByText('과일 가게')).toBeInTheDocument();
    expect(card().getByText('20명이 모이면 확정돼요')).toBeInTheDocument();
  });

  it('받는 곳만 비어 있으면 그 행만 숨는다', async () => {
    addOffer('OPEN', { id: 't-one', pickupPlace: undefined });
    await openDetail('t-one');

    expect(card().getByText('받는 날')).toBeInTheDocument();
    expect(card().queryByText('받는 곳')).not.toBeInTheDocument();
  });
});

describe('제안 상세: 판매 끝', () => {
  it('「판매 끝」은 시안의 팝업(제목·본문·[취소][끝내기])을 연다', async () => {
    const user = userEvent.setup();
    await openDetail('offer-seed-2');

    await user.click(actionButton(COMPLETE));

    expect(dialog()).toHaveAccessibleName('판매를 끝낼까요?');
    expect(
      within(dialog()).getByText(
        '모두 받아 갔다면 "수령 끝"으로 바꿔요. 이 기록은 창업자 리포트의 실제 수령 숫자에 들어가요.',
      ),
    ).toBeInTheDocument();
    expect(within(dialog()).getByRole('button', { name: '취소' })).toBeInTheDocument();
    expect(within(dialog()).getByRole('button', { name: '끝내기' })).toBeInTheDocument();
  });

  it('[끝내기]가 성공하면 팝업이 닫히고 화면이 바로 수령 끝(뱃지·안내 바뀜, 버튼 사라짐)이 된다', async () => {
    const user = userEvent.setup();
    await openDetail('offer-seed-2');
    await user.click(actionButton(COMPLETE));

    await user.click(within(dialog()).getByRole('button', { name: '끝내기' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByText('수령 끝', { selector: 'span' })).toBeInTheDocument();
    expect(screen.queryByText('확정', { selector: 'span' })).not.toBeInTheDocument();
    expect(card().getByText('수령이 끝난 제안이에요')).toBeInTheDocument();
    expect(card().getByText('예약 22명 · 최소 20명')).toBeInTheDocument();
    expect(queryAction(COMPLETE)).not.toBeInTheDocument();
    expect(queryAction(CANCEL)).not.toBeInTheDocument();
    expect(getDb().offers.find((o) => o.id === 'offer-seed-2')?.status).toBe('DONE');
  });

  it('[취소]를 누르면 팝업만 닫히고 아무 일도 일어나지 않는다(서비스 호출 없음)', async () => {
    const user = userEvent.setup();
    const complete = vi.spyOn(offerService, 'completeOffer');
    await openDetail('offer-seed-2');
    await user.click(actionButton(COMPLETE));

    await user.click(within(dialog()).getByRole('button', { name: '취소' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(complete).not.toHaveBeenCalled();
    expect(screen.getByText('확정', { selector: 'span' })).toBeInTheDocument();
    expect(actionButton(COMPLETE)).toBeInTheDocument();
  });

  it('Escape 로 닫아도 아무 일도 일어나지 않는다', async () => {
    const user = userEvent.setup();
    const complete = vi.spyOn(offerService, 'completeOffer');
    await openDetail('offer-seed-2');
    await user.click(actionButton(COMPLETE));

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(complete).not.toHaveBeenCalled();
  });
});

describe('제안 상세: 제안 취소', () => {
  it('「제안 취소」는 임시 팝업(제목·본문·[아니요][제안 취소])을 연다', async () => {
    const user = userEvent.setup();
    await openDetail('offer-seed-1');

    await user.click(actionButton(CANCEL));

    expect(dialog()).toHaveAccessibleName('제안을 취소할까요?');
    expect(
      within(dialog()).getByText('취소한 제안은 되돌릴 수 없고, 예약한 주문도 모두 취소돼요.'),
    ).toBeInTheDocument();
    expect(within(dialog()).getByRole('button', { name: '아니요' })).toBeInTheDocument();
    expect(within(dialog()).getByRole('button', { name: '제안 취소' })).toBeInTheDocument();
  });

  it('OPEN 을 취소하면 취소 뱃지, 안내 문구, 버튼 없음으로 바로 바뀐다', async () => {
    const user = userEvent.setup();
    await openDetail('offer-seed-1');
    await user.click(actionButton(CANCEL));

    await user.click(within(dialog()).getByRole('button', { name: '제안 취소' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByText('취소', { selector: 'span' })).toBeInTheDocument();
    expect(card().getByText('취소한 제안이에요')).toBeInTheDocument();
    expect(queryAction(CANCEL)).not.toBeInTheDocument();
    expect(queryAction(COMPLETE)).not.toBeInTheDocument();
  });

  it('확정된 제안을 취소하면 예약이 0명이 되고 막대가 비며 취소 뱃지가 된다', async () => {
    const user = userEvent.setup();
    await openDetail('offer-seed-2');
    expect(card().getByText('예약 22명 · 최소 20명')).toBeInTheDocument();
    await user.click(actionButton(CANCEL));

    await user.click(within(dialog()).getByRole('button', { name: '제안 취소' }));

    await waitFor(() => expect(card().getByText('예약 0명 · 최소 20명')).toBeInTheDocument());
    expect(screen.getByText('취소', { selector: 'span' })).toBeInTheDocument();
    expect((bar().firstElementChild as HTMLElement).style.width).toBe('0%');
    expect(queryAction(COMPLETE)).not.toBeInTheDocument();
  });

  it('[아니요]를 누르면 아무 일도 일어나지 않는다', async () => {
    const user = userEvent.setup();
    const cancel = vi.spyOn(offerService, 'cancelOffer');
    await openDetail('offer-seed-1');
    await user.click(actionButton(CANCEL));

    await user.click(within(dialog()).getByRole('button', { name: '아니요' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(cancel).not.toHaveBeenCalled();
    expect(screen.getByText('모집 중')).toBeInTheDocument();
  });

  it('취소한 뒤 뒤로 가면 목록에 취소 뱃지로 최신 상태가 보인다', async () => {
    const user = userEvent.setup();
    renderApp(['/merchant/offers']);
    await user.click(await screen.findByRole('link', { name: '제철 과일 꾸러미' }));
    await heading1('제안 상세');
    await user.click(actionButton(CANCEL));
    await user.click(within(dialog()).getByRole('button', { name: '제안 취소' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: '뒤로 가기' }));

    const article = await screen.findByRole('article', { name: '제철 과일 꾸러미' });
    expect(within(article).getByText('취소')).toBeInTheDocument();
  });
});

describe('제안 상세: 오류와 재조회', () => {
  it('OFFER_CLOSED(409): 안내 문구를 보이고 서버 상태로 다시 불러와 화면을 맞춘다(OPEN 을 열어 둔 사이 마감된 경우)', async () => {
    const user = userEvent.setup();
    await openDetail('offer-seed-1');
    // 열어 두는 사이 서버 쪽 상태가 바뀌었다(마감 시각이 지나 CLOSED).
    getDb().offers.find((o) => o.id === 'offer-seed-1')!.status = 'CLOSED';
    await user.click(actionButton(CANCEL));

    await user.click(within(dialog()).getByRole('button', { name: '제안 취소' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '지금은 처리할 수 없는 상태예요. 최신 상태로 다시 보여드릴게요.',
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    // 서버 상태(CLOSED)로 다시 맞춰져 뱃지·안내가 바뀌고 버튼이 사라진다.
    await waitFor(() => expect(screen.getByText('마감', { selector: 'span' })).toBeInTheDocument());
    expect(card().getByText('마감됐지만 최소 인원을 채우지 못했어요')).toBeInTheDocument();
    expect(queryAction(CANCEL)).not.toBeInTheDocument();
    expect(screen.queryByText('모집 중')).not.toBeInTheDocument();
  });

  it('판매 끝도 OFFER_CLOSED 면 같은 안내와 재조회다(이미 수령 끝으로 바뀐 경우)', async () => {
    const user = userEvent.setup();
    await openDetail('offer-seed-2');
    getDb().offers.find((o) => o.id === 'offer-seed-2')!.status = 'DONE';
    await user.click(actionButton(COMPLETE));

    await user.click(within(dialog()).getByRole('button', { name: '끝내기' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('지금은 처리할 수 없는 상태예요');
    await waitFor(() =>
      expect(screen.getByText('수령 끝', { selector: 'span' })).toBeInTheDocument(),
    );
    expect(queryAction(COMPLETE)).not.toBeInTheDocument();
  });

  it('처리 중 그 제안이 없어지면(404) "찾을 수 없는 제안" 화면이 된다', async () => {
    const user = userEvent.setup();
    await openDetail('offer-seed-1');
    getDb().offers = getDb().offers.filter((o) => o.id !== 'offer-seed-1');
    await user.click(actionButton(CANCEL));

    await user.click(within(dialog()).getByRole('button', { name: '제안 취소' }));

    expect(await screen.findByText('찾을 수 없는 제안이에요')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '제안 목록으로' })).toBeInTheDocument();
  });

  it('403 FORBIDDEN 은 내 제안이 아니라는 안내이고 서버 message 는 보이지 않는다', async () => {
    const user = userEvent.setup();
    vi.spyOn(offerService, 'cancelOffer').mockRejectedValue(
      new ApiError({ kind: 'http', status: 403, code: 'FORBIDDEN', message: '서버 원문' }),
    );
    await openDetail('offer-seed-1');
    await user.click(actionButton(CANCEL));

    await user.click(within(dialog()).getByRole('button', { name: '제안 취소' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '내 제안이 아니라서 처리할 수 없어요.',
    );
    expect(screen.queryByText(/서버 원문/)).not.toBeInTheDocument();
    expect(screen.getByText('모집 중')).toBeInTheDocument();
    expect(actionButton(CANCEL)).toBeEnabled();
  });

  it('네트워크 오류는 기존 연결 확인 문구이고 화면은 그대로다(다시 누를 수 있다)', async () => {
    const user = userEvent.setup();
    vi.spyOn(offerService, 'completeOffer').mockRejectedValue(
      new ApiError({ kind: 'network', message: 'x' }),
    );
    await openDetail('offer-seed-2');
    await user.click(actionButton(COMPLETE));

    await user.click(within(dialog()).getByRole('button', { name: '끝내기' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '네트워크 연결을 확인하고 다시 시도해 주세요.',
    );
    expect(screen.getByText('확정', { selector: 'span' })).toBeInTheDocument();
    expect(actionButton(COMPLETE)).toBeEnabled();
  });

  it('다음 처리를 시작하면 이전 오류 안내가 사라진다', async () => {
    const user = userEvent.setup();
    vi.spyOn(offerService, 'completeOffer').mockRejectedValueOnce(
      new ApiError({ kind: 'network', message: 'x' }),
    );
    await openDetail('offer-seed-2');
    await user.click(actionButton(COMPLETE));
    await user.click(within(dialog()).getByRole('button', { name: '끝내기' }));
    await screen.findByRole('alert');

    await user.click(actionButton(COMPLETE));
    await user.click(within(dialog()).getByRole('button', { name: '끝내기' }));

    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    expect(screen.getByText('수령 끝', { selector: 'span' })).toBeInTheDocument();
  });
});

describe('제안 상세: 중복 클릭과 데모', () => {
  it('처리 중에는 연타해도 한 번만 호출하고 버튼이 막히며 처리 중 표시가 보인다', async () => {
    const user = userEvent.setup();
    let release: (offer: OwnerOffer) => void = () => undefined;
    const cancel = vi.spyOn(offerService, 'cancelOffer').mockReturnValue(
      new Promise<OwnerOffer>((resolve) => {
        release = resolve;
      }),
    );
    await openDetail('offer-seed-1');
    await user.click(actionButton(CANCEL));
    const confirm = within(dialog()).getByRole('button', { name: /^제안 취소/ });

    await user.click(confirm);
    await user.click(confirm);
    await user.click(confirm);

    expect(cancel).toHaveBeenCalledTimes(1);
    expect(confirm).toHaveAttribute('aria-busy', 'true');
    release({
      id: 'offer-seed-1',
      title: '제철 과일 꾸러미',
      status: 'CANCELLED',
      orderCount: 0,
      minOrders: 20,
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByText('취소', { selector: 'span' })).toBeInTheDocument();
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('데모 OWNER 도 판매 끝·제안 취소를 막지 않는다(데모 차단 문구 없음)', async () => {
    const user = userEvent.setup();
    vi.spyOn(authService, 'isDemoSession').mockReturnValue(true);
    await openDetail('offer-seed-2');

    await user.click(actionButton(COMPLETE));
    await user.click(within(dialog()).getByRole('button', { name: '끝내기' }));

    await waitFor(() =>
      expect(screen.getByText('수령 끝', { selector: 'span' })).toBeInTheDocument(),
    );
    expect(screen.queryByText(/데모 계정은 사장님 화면만/)).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
