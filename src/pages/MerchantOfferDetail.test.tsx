import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getDb } from '@/mocks/memoryDb';
import { authService, merchantService, NoShopError, offerService } from '@/services';
import { ApiError } from '@/services/api/apiError';
import { renderApp } from '@/test/renderApp';
import type { OfferStatus, OwnerOffer } from '@/types/domain';

const heading1 = (name: string) => screen.findByRole('heading', { level: 1, name });
const dialog = () => screen.getByRole('dialog');
const actionButton = (name: string) => screen.getByRole('button', { name });
const queryAction = (name: string | RegExp) => screen.queryByRole('button', { name });
const COMPLETE = '수령 완료 처리';
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

async function openDetail(id: string, state?: unknown) {
  const view = renderApp([
    state === undefined ? `/merchant/offers/${id}` : { pathname: `/merchant/offers/${id}`, state },
  ]);
  await heading1('보낸 제안 상세');
  await screen.findByRole('heading', { level: 2 });
  return view;
}
const bar = () => screen.getByRole('progressbar');
const queryToList = () => screen.queryByRole('link', { name: '보낸 제안으로' });

afterEach(() => vi.restoreAllMocks());

describe('제안 상세: 진입', () => {
  it('내 가게 목록의 제안 카드를 누르면 그 제안의 상세로 간다(카드는 링크다)', async () => {
    const user = userEvent.setup();
    const { router } = renderApp(['/merchant/offers']);

    const link = await screen.findByRole('link', { name: '제철 과일 꾸러미' });
    expect(link).toHaveAttribute('href', '/merchant/offers/offer-seed-1');
    await user.click(link);

    expect(await heading1('보낸 제안 상세')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/merchant/offers/offer-seed-1');
    expect(
      await screen.findByRole('heading', { level: 2, name: '싱싱과일 / 제철 과일 꾸러미' }),
    ).toBeInTheDocument();
  });

  it('뒤로 가기는 목록으로 돌아간다', async () => {
    const user = userEvent.setup();
    const { router } = renderApp(['/merchant/offers']);
    await user.click(await screen.findByRole('link', { name: '제철 과일 꾸러미' }));
    await heading1('보낸 제안 상세');

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
  it('OPEN: 뱃지·마감·"가게 / 제안"·설명·값 행·막대·상태 카드, 버튼은 「제안 취소」(기본 버튼) 하나뿐이다', async () => {
    await openDetail('offer-seed-1');

    expect(screen.getByText('모집 중')).toBeInTheDocument();
    expect(screen.getByText('마감 11/14(토) 18:00')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: '싱싱과일 / 제철 과일 꾸러미' }),
    ).toBeInTheDocument();
    expect(screen.getByText('제철 과일을 소포장으로 동네에서 받아 가요')).toBeInTheDocument();
    const rows = [...document.querySelectorAll('dl > div')].map((row) => row.textContent);
    expect(rows).toEqual([
      '가격15,000원',
      '받는 날11/15(일) 오전 10:00',
      '마감11/14(토) 18:00',
      '받는 곳구성동 주민센터 앞',
    ]);
    expect(bar()).toHaveAccessibleName('0 / 20명 예약');
    expect((bar().firstElementChild as HTMLElement).style.width).toBe('0%');
    // 상태 카드 하나(위쪽 "예약 N명 · 최소 M명" 카드와 예전 안내 문구는 없다)
    expect(screen.getByText('현재 0명 / 최소 20명')).toBeInTheDocument();
    expect(screen.getByText('주문 마감 후 확정 여부가 정해져요')).toBeInTheDocument();
    expect(screen.queryByText(/예약 0명/)).not.toBeInTheDocument();
    expect(queryAction(COMPLETE)).not.toBeInTheDocument();
    expect(actionButton(CANCEL)).toBeInTheDocument();
    expect(queryToList()).not.toBeInTheDocument();
  });

  it('시안의 샘플 값(11/12·30.000원 등)은 쓰지 않고 실제 데이터로 계산한다', async () => {
    await openDetail('offer-seed-1');

    expect(screen.queryByText(/11\/12/)).not.toBeInTheDocument();
    expect(screen.queryByText(/30\.000/)).not.toBeInTheDocument();
    // 시안에서 제목이 한 번 더 반복되는 소제목은 그리지 않는다.
    expect(screen.getAllByText(/제철 과일 꾸러미/)).toHaveLength(1);
  });

  it('CONFIRMED: 뱃지 "확정", 받는 곳 행 유지, 상태 카드 하나, 「수령 완료 처리」(기본)와 「제안 취소」(보조)', async () => {
    await openDetail('offer-seed-2');

    expect(screen.getByText('확정')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: '싱싱과일 / 주말 채소 박스' }),
    ).toBeInTheDocument();
    // 설명이 없는 제안이라 부제 줄이 없다.
    expect(document.querySelector('h2 + p')).toBeNull();
    expect(screen.getByText('받는 곳').nextElementSibling).toHaveTextContent(
      '보정동 행정복지센터 앞',
    );
    expect(screen.getByText('22 / 20명 예약')).toBeInTheDocument();
    expect((bar().firstElementChild as HTMLElement).style.width).toBe('100%');
    // 숫자는 orderCount 하나만 쓴다(시안의 22명·24명 불일치가 없다).
    expect(screen.getByText('현재 22명 / 최소 20명')).toBeInTheDocument();
    expect(screen.getByText('최소 인원이 채워져 제안이 확정됐어요')).toBeInTheDocument();
    expect(screen.queryByText(/24명|예약 22명/)).not.toBeInTheDocument();
    expect(actionButton(COMPLETE).className).toBe(
      actionButton(CANCEL).className.replace('neutral', 'highlight'),
    );
    expect(actionButton(COMPLETE)).not.toBe(actionButton(CANCEL));
    expect(queryToList()).not.toBeInTheDocument();
  });

  it('OPEN 인데 인원이 이미 찼어도 "확정됐어요"라고 쓰지 않는다(서버는 마감 뒤에야 확정한다)', async () => {
    addOffer('OPEN', { id: 't-full', orderCount: 25 });
    await openDetail('t-full');

    expect(screen.getByText('현재 25명 / 최소 20명')).toBeInTheDocument();
    expect(screen.getByText('주문 마감 후 확정 여부가 정해져요')).toBeInTheDocument();
    expect(screen.queryByText(/확정됐어요/)).not.toBeInTheDocument();
    expect(screen.getByText('모집 중')).toBeInTheDocument();
    expect(queryAction(COMPLETE)).not.toBeInTheDocument();
  });

  it.each([
    ['CLOSED', '마감', '최소 인원 모집을 채우지 못했어요'],
    ['CANCELLED', '취소', '취소한 제안이에요'],
    ['DONE', '완료', '수량이 완료된 제안이에요'],
  ] as const)(
    '%s: 뱃지 "%s", 부제 "%s", 상태 카드 없이 버튼은 「보낸 제안으로」뿐이다',
    async (status, badge, subtitle) => {
      addOffer(status, { description: '설명은 상태 문구가 대신한다' });
      await openDetail(`t-${status}`);

      expect(screen.getByText(badge, { selector: 'span' })).toBeInTheDocument();
      expect(screen.getByText(subtitle)).toBeInTheDocument();
      expect(screen.queryByText('설명은 상태 문구가 대신한다')).not.toBeInTheDocument();
      expect(screen.queryByText(/^현재 \d+명/)).not.toBeInTheDocument();
      expect(queryAction(COMPLETE)).not.toBeInTheDocument();
      expect(queryAction(CANCEL)).not.toBeInTheDocument();
      expect(screen.getByRole('link', { name: '보낸 제안으로' })).toHaveAttribute(
        'href',
        '/merchant/offers',
      );
    },
  );

  it('「보낸 제안으로」를 누르면 제안 목록으로 간다', async () => {
    const user = userEvent.setup();
    addOffer('DONE');
    const { router } = await openDetail('t-DONE');

    await user.click(screen.getByRole('link', { name: '보낸 제안으로' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/merchant/offers'));
  });

  it('막대 비율은 예약 ÷ 최소 주문이고 초과하면 가득 찬다(aria 값은 최소 주문을 넘지 않는다)', async () => {
    addOffer('OPEN', { id: 't-half', orderCount: 10 });
    addOffer('OPEN', { id: 't-over', orderCount: 30 });

    const { unmount } = await openDetail('t-half');
    expect((bar().firstElementChild as HTMLElement).style.width).toBe('50%');
    expect(bar()).toHaveAccessibleName('10 / 20명 예약');
    unmount();

    await openDetail('t-over');
    expect((bar().firstElementChild as HTMLElement).style.width).toBe('100%');
    expect(bar()).toHaveAttribute('aria-valuenow', '20');
    expect(bar()).toHaveAttribute('aria-valuemax', '20');
  });

  it('설명이 있으면 부제로 보이고, 없으면 그 줄을 숨긴다', async () => {
    addOffer('OPEN', { id: 't-desc', description: '직접 쓴 설명입니다' });
    addOffer('OPEN', { id: 't-nodesc' });

    const { unmount } = await openDetail('t-desc');
    expect(screen.getByText('직접 쓴 설명입니다')).toBeInTheDocument();
    unmount();

    await openDetail('t-nodesc');
    expect(document.querySelector('h2 + p')).toBeNull();
  });

  it('가게 정보를 못 불러오면 제목 줄은 제안 제목만 보인다', async () => {
    vi.spyOn(merchantService, 'getProfile').mockRejectedValue(new NoShopError());
    await openDetail('offer-seed-1');

    expect(screen.getByRole('heading', { level: 2, name: '제철 과일 꾸러미' })).toBeInTheDocument();
    expect(screen.queryByText(/싱싱과일/)).not.toBeInTheDocument();
  });

  it('값이 비어 있으면 그 행·문구를 숨긴다(받는 날·받는 곳·마감)', async () => {
    addOffer('OPEN', {
      id: 't-empty',
      pickupAt: undefined,
      pickupPlace: undefined,
      deadlineAt: undefined,
      price: undefined,
    });
    await openDetail('t-empty');

    expect(document.querySelectorAll('dl > div')).toHaveLength(0);
    expect(screen.queryByText(/^마감 /)).not.toBeInTheDocument();
    expect(screen.getByText('현재 5명 / 최소 20명')).toBeInTheDocument();
  });

  it('받는 곳만 비어 있으면 그 행만 숨는다', async () => {
    addOffer('OPEN', { id: 't-one', pickupPlace: undefined });
    await openDetail('t-one');

    expect(screen.getByText('받는 날')).toBeInTheDocument();
    expect(screen.queryByText('받는 곳')).not.toBeInTheDocument();
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
    expect(screen.getByText('완료', { selector: 'span' })).toBeInTheDocument();
    expect(screen.queryByText('확정', { selector: 'span' })).not.toBeInTheDocument();
    expect(screen.getByText('수량이 완료된 제안이에요')).toBeInTheDocument();
    expect(screen.getByText('22 / 20명 예약')).toBeInTheDocument();
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
  it('「제안 취소」는 팝업(제목·본문·[돌아가기][취소하기])을 열고 취소 사유 입력칸은 없다', async () => {
    const user = userEvent.setup();
    await openDetail('offer-seed-1');

    await user.click(actionButton(CANCEL));

    expect(dialog()).toHaveAccessibleName('제안을 취소할까요?');
    expect(
      within(dialog()).getByText('취소한 제안은 되돌릴 수 없고, 예약한 주문도 모두 취소돼요.'),
    ).toBeInTheDocument();
    expect(within(dialog()).getByRole('button', { name: '돌아가기' })).toBeInTheDocument();
    expect(within(dialog()).getByRole('button', { name: '취소하기' })).toBeInTheDocument();
    // 서버가 취소 사유를 받지 않으므로 입력칸이 없고, 시안의 주민용 본문도 쓰지 않는다.
    expect(within(dialog()).queryByRole('textbox')).not.toBeInTheDocument();
    expect(within(dialog()).queryByText(/예약 인원에서 빠져요/)).not.toBeInTheDocument();
  });

  it('OPEN 을 취소하면 취소 뱃지, 안내 문구, 버튼 없음으로 바로 바뀐다', async () => {
    const user = userEvent.setup();
    await openDetail('offer-seed-1');
    await user.click(actionButton(CANCEL));

    await user.click(within(dialog()).getByRole('button', { name: '취소하기' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByText('취소', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByText('취소한 제안이에요')).toBeInTheDocument();
    expect(queryAction(CANCEL)).not.toBeInTheDocument();
    expect(queryAction(COMPLETE)).not.toBeInTheDocument();
  });

  it('확정된 제안을 취소하면 예약이 0명이 되고 막대가 비며 취소 뱃지가 된다', async () => {
    const user = userEvent.setup();
    await openDetail('offer-seed-2');
    expect(screen.getByText('22 / 20명 예약')).toBeInTheDocument();
    await user.click(actionButton(CANCEL));

    await user.click(within(dialog()).getByRole('button', { name: '취소하기' }));

    await waitFor(() => expect(screen.getByText('0 / 20명 예약')).toBeInTheDocument());
    expect(screen.getByText('취소', { selector: 'span' })).toBeInTheDocument();
    expect((bar().firstElementChild as HTMLElement).style.width).toBe('0%');
    expect(queryAction(COMPLETE)).not.toBeInTheDocument();
  });

  it('[돌아가기]를 누르면 아무 일도 일어나지 않는다', async () => {
    const user = userEvent.setup();
    const cancel = vi.spyOn(offerService, 'cancelOffer');
    await openDetail('offer-seed-1');
    await user.click(actionButton(CANCEL));

    await user.click(within(dialog()).getByRole('button', { name: '돌아가기' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(cancel).not.toHaveBeenCalled();
    expect(screen.getByText('모집 중')).toBeInTheDocument();
  });

  it('취소한 뒤 뒤로 가면 목록에 취소 뱃지로 최신 상태가 보인다', async () => {
    const user = userEvent.setup();
    renderApp(['/merchant/offers']);
    await user.click(await screen.findByRole('link', { name: '제철 과일 꾸러미' }));
    await heading1('보낸 제안 상세');
    await user.click(actionButton(CANCEL));
    await user.click(within(dialog()).getByRole('button', { name: '취소하기' }));
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

    await user.click(within(dialog()).getByRole('button', { name: '취소하기' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '지금은 처리할 수 없는 상태예요. 최신 상태로 다시 보여드릴게요.',
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    // 서버 상태(CLOSED)로 다시 맞춰져 뱃지·안내가 바뀌고 버튼이 사라진다.
    await waitFor(() => expect(screen.getByText('마감', { selector: 'span' })).toBeInTheDocument());
    expect(screen.getByText('최소 인원 모집을 채우지 못했어요')).toBeInTheDocument();
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
    await waitFor(() => expect(screen.getByText('완료', { selector: 'span' })).toBeInTheDocument());
    expect(queryAction(COMPLETE)).not.toBeInTheDocument();
  });

  it('처리 중 그 제안이 없어지면(404) "찾을 수 없는 제안" 화면이 된다', async () => {
    const user = userEvent.setup();
    await openDetail('offer-seed-1');
    getDb().offers = getDb().offers.filter((o) => o.id !== 'offer-seed-1');
    await user.click(actionButton(CANCEL));

    await user.click(within(dialog()).getByRole('button', { name: '취소하기' }));

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

    await user.click(within(dialog()).getByRole('button', { name: '취소하기' }));

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
    expect(screen.getByText('완료', { selector: 'span' })).toBeInTheDocument();
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
    const confirm = within(dialog()).getByRole('button', { name: '취소하기' });

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

    await waitFor(() => expect(screen.getByText('완료', { selector: 'span' })).toBeInTheDocument());
    expect(screen.queryByText(/데모 계정은 사장님 화면만/)).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('제안 상세: 제안을 보낸 직후(배너)', () => {
  const sent = (notifiedResidentCount?: number) => ({
    justSent: true,
    ...(notifiedResidentCount !== undefined && { notifiedResidentCount }),
  });

  it('작성 화면이 넘긴 state 가 있으면 맨 위에 "제안을 보냈어요!" 배너와 "{N}명의 주민에게 알렸어요"가 보인다', async () => {
    await openDetail('offer-seed-1', sent(29));

    const banner = screen.getByRole('status');
    expect(banner).toHaveTextContent('제안을 보냈어요!');
    expect(screen.getByRole('heading', { level: 3, name: '모집 현황' })).toBeInTheDocument();
    expect(screen.getByText('29명의 주민에게 알렸어요')).toBeInTheDocument();
    // 배너는 상태 줄보다 위에 있다.
    expect(
      banner.compareDocumentPosition(screen.getByText('모집 중')) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    // 일반 상세와 같은 상태별 버튼 규칙(OPEN 은 「제안 취소」)을 쓴다.
    expect(actionButton(CANCEL)).toBeInTheDocument();
    expect(queryAction(/선주문/)).not.toBeInTheDocument();
  });

  it('알린 주민이 0명이어도 "0명의 주민에게 알렸어요"를 보인다', async () => {
    await openDetail('offer-seed-1', sent(0));

    expect(screen.getByText('0명의 주민에게 알렸어요')).toBeInTheDocument();
  });

  it('알린 주민 수를 모르면 배너만 보이고 모집 현황 영역은 없다', async () => {
    await openDetail('offer-seed-1', sent());

    expect(screen.getByRole('status')).toHaveTextContent('제안을 보냈어요!');
    expect(screen.queryByRole('heading', { level: 3, name: '모집 현황' })).not.toBeInTheDocument();
  });

  it('state 가 없으면(새로고침·다시 들어옴) 배너와 알린 주민 영역이 없다', async () => {
    await openDetail('offer-seed-1');

    expect(screen.queryByText('제안을 보냈어요!')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByText(/명의 주민에게 알렸어요/)).not.toBeInTheDocument();
  });

  it('state 를 읽은 뒤 지워서 새로고침해도 배너가 다시 뜨지 않고, 이 화면에서는 배너가 유지된다', async () => {
    const { router } = await openDetail('offer-seed-1', sent(5));

    await waitFor(() => expect(router.state.location.state).toBeNull());
    expect(router.state.location.pathname).toBe('/merchant/offers/offer-seed-1');
    expect(screen.getByText('제안을 보냈어요!')).toBeInTheDocument();
  });

  it('justSent 가 아닌 모양의 state 는 무시한다', async () => {
    await openDetail('offer-seed-1', { justSent: 'yes', notifiedResidentCount: 3 });

    expect(screen.queryByText('제안을 보냈어요!')).not.toBeInTheDocument();
  });

  it('만든 직후 목록에서 못 찾으면 한 번 다시 조회한다', async () => {
    const real = offerService.getOwnerOffer.bind(offerService);
    const spy = vi
      .spyOn(offerService, 'getOwnerOffer')
      .mockResolvedValueOnce(null)
      .mockImplementation(real);
    await openDetail('offer-seed-1', sent(2));

    expect(spy).toHaveBeenCalledTimes(2);
    expect(screen.getByText('모집 중')).toBeInTheDocument();
  });

  it('state 가 없으면 못 찾아도 다시 조회하지 않고 "찾을 수 없는 제안" 이다', async () => {
    const spy = vi.spyOn(offerService, 'getOwnerOffer').mockResolvedValue(null);
    renderApp(['/merchant/offers/offer-seed-1']);

    expect(await screen.findByText('찾을 수 없는 제안이에요')).toBeInTheDocument();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('다시 조회해도 없으면 "찾을 수 없는 제안" 이다', async () => {
    const spy = vi.spyOn(offerService, 'getOwnerOffer').mockResolvedValue(null);
    renderApp([{ pathname: '/merchant/offers/offer-seed-1', state: sent(2) }]);

    expect(await screen.findByText('찾을 수 없는 제안이에요')).toBeInTheDocument();
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
