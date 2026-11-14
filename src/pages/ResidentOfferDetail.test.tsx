import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getDb } from '@/mocks/memoryDb';
import { myRequestService, orderService } from '@/services';
import { ApiError } from '@/services/api/apiError';
import { renderApp } from '@/test/renderApp';
import type { MyOrder, ResidentOffer, ResidentOfferStatus } from '@/types/domain';

const SEED_OPEN = 'mock-offer-seed-1'; // 맛나반찬 · 모집 중 · 주문 없음 · 8/20명 · 15,000원
const SEED_CONFIRMED = 'mock-offer-seed-2'; // 확정 + 내 예약 2개
const SEED_RESERVED = 'mock-offer-seed-3'; // 모집 중 + 내 예약 1개 · 4/15명
const SEED_DONE = 'mock-offer-seed-4'; // 수령 끝 + 받아 감
const SEED_CLOSED = 'mock-offer-seed-5'; // 마감

const heading1 = (name: string) => screen.findByRole('heading', { level: 1, name });
const button = (name: string | RegExp) => screen.getByRole('button', { name });
const queryButton = (name: string | RegExp) => screen.queryByRole('button', { name });
const quantityGroup = () => screen.getByRole('group', { name: '수량' });
const quantityValue = () => within(quantityGroup()).getByRole('status');

/** 테스트용 제안을 메모리 DB 의 첫 요청에 직접 넣는다. */
function addOffer(
  status: ResidentOfferStatus,
  overrides: Partial<ResidentOffer> = {},
): ResidentOffer {
  const offer: ResidentOffer = {
    id: `t-${status}`,
    shopName: '테스트가게',
    title: `테스트 ${status}`,
    price: 10000,
    pickupAt: new Date('2026-11-20T10:00:00+09:00'),
    pickupPlace: '테스트 장소',
    minOrders: 20,
    orderCount: 5,
    deadlineAt: new Date('2026-11-18T18:00:00+09:00'),
    status,
    myOrder: null,
    ...overrides,
  };
  getDb().requests[0]!.offers!.push(offer);
  return offer;
}
const dbOffer = (id: string) => getDb().requests[0]!.offers!.find((o) => o.id === id)!;

async function openDetail(id: string, title = '사장님 제안') {
  const view = renderApp([`/resident/offers/${id}`]);
  await heading1(title);
  await screen.findByRole('heading', { level: 2 });
  return view;
}
const apiError = (status: number, code: string) =>
  new ApiError({ kind: 'http', status, code, message: '서버 원문' });

afterEach(() => vi.restoreAllMocks());

describe('진입', () => {
  it('내 요청 카드의 "사장님 응답"을 누르면 그 제안의 상세로 간다(링크다)', async () => {
    const user = userEvent.setup();
    const { router } = renderApp(['/resident/requests']);

    const link = await screen.findByRole('link', { name: /^사장님 응답/ });
    expect(link).toHaveAttribute('href', `/resident/offers/${SEED_OPEN}`);
    await user.click(link);

    expect(await heading1('사장님 제안')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(`/resident/offers/${SEED_OPEN}`);
    expect(
      await screen.findByRole('heading', { level: 2, name: '맛나반찬 / [임의] 제철 반찬 꾸러미' }),
    ).toBeInTheDocument();
  });

  it('하단 내비게이션이 없다(시안에 없다)', async () => {
    await openDetail(SEED_OPEN);

    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('뒤로 가기는 내 요청으로 돌아간다(직접 진입이면 내 요청으로 이동)', async () => {
    const user = userEvent.setup();
    const { router } = await openDetail(SEED_OPEN);

    await user.click(screen.getByRole('button', { name: '뒤로 가기' }));

    expect(router.state.location.pathname).toBe('/resident/requests');
  });
});

describe('상세 값 표시', () => {
  it('상태 줄(뱃지 + 마감), "사장님 / 제목", 가격·받는 날·마감·받는 곳 행을 실제 데이터로 보여준다', async () => {
    await openDetail(SEED_OPEN);

    expect(screen.getByText('모집 중')).toBeInTheDocument();
    expect(screen.getByText('마감 11/13(금) 18:00')).toBeInTheDocument();
    const rows = [...document.querySelectorAll('dl > div')].map((row) => row.textContent);
    expect(rows).toEqual([
      '가격15,000원',
      '받는 날11/14(토) 오전 10:00',
      '마감11/13(금) 18:00',
      '받는 곳구성동 주민센터 앞',
    ]);
  });

  it('시안의 샘플 값(싱싱과일·30.000원 등)이나 제안 설명 문장은 그리지 않는다', async () => {
    await openDetail(SEED_OPEN);

    expect(screen.queryByText(/싱싱과일/)).not.toBeInTheDocument();
    expect(screen.queryByText(/3만 원이치/)).not.toBeInTheDocument();
    expect(screen.queryByText('0 / 20명 예약')).not.toBeInTheDocument();
    expect(screen.queryByText(/29 \/ 30명/)).not.toBeInTheDocument();
  });

  it('받는 곳이 비어 있으면 그 행만 숨긴다', async () => {
    addOffer('OPEN', { pickupPlace: '' });
    await openDetail('t-OPEN');

    const labels = [...document.querySelectorAll('dt')].map((el) => el.textContent);
    expect(labels).toEqual(['가격', '받는 날', '마감']);
  });
});

describe('모집 현황', () => {
  it('"모집 현황" 막대 하나만 있고 예약 ÷ 최소 주문으로 채운다', async () => {
    await openDetail(SEED_OPEN);

    expect(screen.getAllByRole('progressbar')).toHaveLength(1);
    const bar = screen.getByRole('progressbar', { name: '모집 현황' });
    expect(bar).toHaveAttribute('aria-valuenow', '8');
    expect(bar).toHaveAttribute('aria-valuemax', '20');
    expect((bar.firstElementChild as HTMLElement).style.width).toBe('40%');
    expect(screen.getByText('8 / 20명 · 12명만 더 모이면 돼요')).toBeInTheDocument();
  });

  it('최소 인원 이상이면 가득 차고 "최소 인원을 채웠어요"다(초과해도 가득)', async () => {
    addOffer('OPEN', { orderCount: 27, minOrders: 20 });
    await openDetail('t-OPEN');

    const bar = screen.getByRole('progressbar', { name: '모집 현황' });
    expect((bar.firstElementChild as HTMLElement).style.width).toBe('100%');
    expect(screen.getByText('27 / 20명 · 최소 인원을 채웠어요')).toBeInTheDocument();
    expect(bar).toHaveAttribute('aria-valuenow', '20');
  });
});

describe('수량과 금액', () => {
  it('기본 수량 1, 「선주문하기 15,000원」이고 +·−로 1~10 사이에서 바뀐다(금액은 천 단위 쉼표)', async () => {
    const user = userEvent.setup();
    await openDetail(SEED_OPEN);

    expect(quantityValue()).toHaveTextContent('1');
    expect(button('선주문하기 15,000원')).toBeInTheDocument();
    expect(button('수량 줄이기')).toBeDisabled();

    await user.click(button('수량 늘리기'));

    expect(quantityValue()).toHaveTextContent('2');
    expect(button('선주문하기 30,000원')).toBeInTheDocument();
    expect(button('수량 줄이기')).toBeEnabled();
  });

  it('10 을 넘길 수 없다: 10 에서 + 는 비활성이고 금액은 150,000원이다', async () => {
    const user = userEvent.setup();
    await openDetail(SEED_OPEN);

    for (let i = 0; i < 12; i += 1) {
      if (!(button('수량 늘리기') as HTMLButtonElement).disabled)
        await user.click(button('수량 늘리기'));
    }

    expect(quantityValue()).toHaveTextContent('10');
    expect(button('수량 늘리기')).toBeDisabled();
    expect(button('선주문하기 150,000원')).toBeInTheDocument();

    await user.click(button('수량 줄이기'));
    expect(quantityValue()).toHaveTextContent('9');
  });
});

describe('상태별 버튼·문구', () => {
  it('OPEN + 주문 없음: 수량 선택과 「선주문하기」', async () => {
    await openDetail(SEED_OPEN);

    expect(quantityGroup()).toBeInTheDocument();
    expect(button(/^선주문하기/)).toBeInTheDocument();
    expect(queryButton('예약 취소하기')).not.toBeInTheDocument();
    expect(screen.queryByText(/내 예약/)).not.toBeInTheDocument();
  });

  it('OPEN + 예약(RESERVED): 수량 선택은 숨기고 "내 예약: N개"와 「예약 취소하기」', async () => {
    await openDetail(SEED_RESERVED);

    expect(screen.getByText('내 예약: 1개')).toBeInTheDocument();
    expect(button('예약 취소하기')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: '수량' })).not.toBeInTheDocument();
    expect(queryButton(/^선주문하기/)).not.toBeInTheDocument();
  });

  it('받아 간(PICKED_UP) 주문: 버튼 없이 "받아 갔어요"', async () => {
    await openDetail(SEED_DONE);

    expect(screen.getByText('받아 갔어요')).toBeInTheDocument();
    expect(queryButton(/선주문|예약 취소/)).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: '수량' })).not.toBeInTheDocument();
  });

  it('CONFIRMED: 버튼 없이 안내 문구, 예약이 있으면 "내 예약: N개"는 보인다', async () => {
    await openDetail(SEED_CONFIRMED);

    expect(screen.getByText('확정됐어요. 이제 새로 주문할 수 없어요')).toBeInTheDocument();
    expect(screen.getByText('내 예약: 2개')).toBeInTheDocument();
    expect(queryButton(/선주문|예약 취소/)).not.toBeInTheDocument();
    expect(screen.getByText('확정')).toBeInTheDocument();
  });

  it('CONFIRMED + 주문 없음: 안내 문구만', async () => {
    addOffer('CONFIRMED');
    await openDetail('t-CONFIRMED');

    expect(screen.getByText('확정됐어요. 이제 새로 주문할 수 없어요')).toBeInTheDocument();
    expect(screen.queryByText(/내 예약/)).not.toBeInTheDocument();
    expect(queryButton(/선주문|예약 취소/)).not.toBeInTheDocument();
  });

  it('CLOSED: 버튼 없이 "마감됐어요"', async () => {
    await openDetail(SEED_CLOSED);

    expect(screen.getByText('마감됐어요')).toBeInTheDocument();
    expect(queryButton(/선주문|예약 취소/)).not.toBeInTheDocument();
  });

  it('DONE(주문 없음): 버튼 없이 "수령이 끝난 제안이에요"', async () => {
    addOffer('DONE');
    await openDetail('t-DONE');

    expect(screen.getByText('수령이 끝난 제안이에요')).toBeInTheDocument();
    expect(queryButton(/선주문|예약 취소/)).not.toBeInTheDocument();
  });
});

describe('선주문', () => {
  it('성공하면 응답으로 바로 예약 상태가 되고(내 예약·예약 취소 버튼·예약 수 증가) 수량 선택은 사라진다', async () => {
    const user = userEvent.setup();
    await openDetail(SEED_OPEN);
    await user.click(button('수량 늘리기'));

    await user.click(button('선주문하기 30,000원'));

    expect(await screen.findByText('내 예약: 2개')).toBeInTheDocument();
    expect(button('예약 취소하기')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: '수량' })).not.toBeInTheDocument();
    expect(screen.getByText('10 / 20명 · 10명만 더 모이면 돼요')).toBeInTheDocument();
    expect(dbOffer(SEED_OPEN).myOrder).toMatchObject({ quantity: 2, status: 'RESERVED' });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('응답으로 바꾼 뒤 서버(목록)에서 다시 불러와 서버 값으로 맞춘다', async () => {
    const user = userEvent.setup();
    await openDetail(SEED_OPEN);
    const original = myRequestService.getResidentOffer.bind(myRequestService);
    let release: (offer: ResidentOffer | null) => void = () => undefined;
    vi.spyOn(myRequestService, 'getResidentOffer').mockImplementation(
      (id) =>
        new Promise((resolve) => {
          release = (offer) => resolve(offer ?? original(id));
        }),
    );

    await user.click(button(/^선주문하기/));

    // 다시 불러오는 응답이 오기 전에도 응답 값으로 이미 바뀌어 있다.
    expect(await screen.findByText('내 예약: 1개')).toBeInTheDocument();
    expect(screen.getByText('9 / 20명 · 11명만 더 모이면 돼요')).toBeInTheDocument();

    // 서버가 다른 주민의 주문까지 더한 값을 주면 그 값으로 맞춘다.
    const server = { ...dbOffer(SEED_OPEN), orderCount: 15 };
    await act(async () => release(server));

    expect(await screen.findByText('15 / 20명 · 5명만 더 모이면 돼요')).toBeInTheDocument();
  });

  it('요청 중에는 버튼을 한 번만 처리한다(중복 클릭 방지)', async () => {
    const user = userEvent.setup();
    await openDetail(SEED_OPEN);
    const real = orderService.createOrder.bind(orderService);
    let finish: () => void = () => undefined;
    const spy = vi.spyOn(orderService, 'createOrder').mockImplementation(
      (offerId, quantity) =>
        new Promise((resolve, reject) => {
          finish = () => real(offerId, quantity).then(resolve, reject);
        }),
    );

    const order = button(/^선주문하기/);
    await user.click(order);
    await user.click(order);
    await user.click(order);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(order).toHaveAttribute('aria-busy', 'true');
    expect(button('수량 늘리기')).toBeDisabled();

    await act(async () => finish());
    expect(await screen.findByText('내 예약: 1개')).toBeInTheDocument();
  });
});

describe('예약 취소', () => {
  const openDialog = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(button('예약 취소하기'));
    return screen.findByRole('dialog', { name: '예약을 취소할까요?' });
  };

  it('팝업은 제목·본문·[닫기]·[예약 취소]를 보여준다', async () => {
    const user = userEvent.setup();
    await openDetail(SEED_RESERVED);

    const dialog = await openDialog(user);

    expect(dialog).toHaveTextContent(
      '취소하면 예약 인원에서 빠져요. 마감 전이면 다시 예약할 수 있어요.',
    );
    expect(within(dialog).getByRole('button', { name: '닫기' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: '예약 취소' })).toBeInTheDocument();
  });

  it('[닫기]는 아무것도 바꾸지 않고 팝업만 닫는다', async () => {
    const user = userEvent.setup();
    await openDetail(SEED_RESERVED);
    const spy = vi.spyOn(orderService, 'cancelOrder');
    const dialog = await openDialog(user);

    await user.click(within(dialog).getByRole('button', { name: '닫기' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();
    expect(screen.getByText('내 예약: 1개')).toBeInTheDocument();
  });

  it('Escape 로도 닫힌다', async () => {
    const user = userEvent.setup();
    await openDetail(SEED_RESERVED);
    const spy = vi.spyOn(orderService, 'cancelOrder');
    await openDialog(user);

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();
  });

  it('[예약 취소]를 누르면 예약이 사라지고 예약 수에서 빠지며 수량 선택과 「선주문하기」가 다시 보인다', async () => {
    const user = userEvent.setup();
    await openDetail(SEED_RESERVED);
    const dialog = await openDialog(user);

    await user.click(within(dialog).getByRole('button', { name: '예약 취소' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await screen.findByRole('group', { name: '수량' })).toBeInTheDocument();
    expect(screen.queryByText(/내 예약/)).not.toBeInTheDocument();
    expect(screen.getByText('3 / 15명 · 12명만 더 모이면 돼요')).toBeInTheDocument();
    expect(dbOffer(SEED_RESERVED).myOrder).toBeNull();
    expect(button('선주문하기 9,000원')).toBeInTheDocument();
  });

  it('취소한 뒤 다시 선주문할 수 있다', async () => {
    const user = userEvent.setup();
    await openDetail(SEED_RESERVED);
    const dialog = await openDialog(user);
    await user.click(within(dialog).getByRole('button', { name: '예약 취소' }));
    await user.click(await screen.findByRole('button', { name: /^선주문하기/ }));

    expect(await screen.findByText('내 예약: 1개')).toBeInTheDocument();
    expect(dbOffer(SEED_RESERVED).myOrder).toMatchObject({ status: 'RESERVED' });
    expect(screen.getByText('4 / 15명 · 11명만 더 모이면 돼요')).toBeInTheDocument();
  });

  it('요청 중에는 [예약 취소]를 한 번만 처리한다', async () => {
    const user = userEvent.setup();
    await openDetail(SEED_RESERVED);
    let finish: () => void = () => undefined;
    const spy = vi.spyOn(orderService, 'cancelOrder').mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const dialog = await openDialog(user);
    const confirm = within(dialog).getByRole('button', { name: '예약 취소' });

    await user.click(confirm);
    await user.click(confirm);

    expect(spy).toHaveBeenCalledTimes(1);
    await act(async () => finish());
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});

describe('오류', () => {
  it('409 ALREADY_ORDERED: 안내 문구를 보이고 서버 상태(예약 있음)로 다시 불러온다', async () => {
    const user = userEvent.setup();
    await openDetail(SEED_OPEN);
    // 다른 기기에서 이미 주문한 상태
    dbOffer(SEED_OPEN).myOrder = { id: 'o-x', offerId: SEED_OPEN, quantity: 3, status: 'RESERVED' };
    vi.spyOn(orderService, 'createOrder').mockRejectedValue(apiError(409, 'ALREADY_ORDERED'));

    await user.click(button(/^선주문하기/));

    expect(await screen.findByRole('alert')).toHaveTextContent('이미 선주문한 제안이에요.');
    expect(await screen.findByText('내 예약: 3개')).toBeInTheDocument();
    expect(button('예약 취소하기')).toBeInTheDocument();
    expect(screen.queryByText(/서버 원문/)).not.toBeInTheDocument();
  });

  it('409 OFFER_CLOSED: 안내 문구를 보이고 서버 상태(마감)로 다시 불러온다', async () => {
    const user = userEvent.setup();
    await openDetail(SEED_OPEN);
    dbOffer(SEED_OPEN).status = 'CLOSED';
    vi.spyOn(orderService, 'createOrder').mockRejectedValue(apiError(409, 'OFFER_CLOSED'));

    await user.click(button(/^선주문하기/));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '주문이 마감됐거나 취소된 제안이에요.',
    );
    expect(await screen.findByText('마감됐어요')).toBeInTheDocument();
    expect(queryButton(/^선주문하기/)).not.toBeInTheDocument();
  });

  it('예약 취소의 409 OFFER_CLOSED 도 문구와 다시 불러오기가 같다', async () => {
    const user = userEvent.setup();
    await openDetail(SEED_RESERVED);
    dbOffer(SEED_RESERVED).status = 'CONFIRMED';
    vi.spyOn(orderService, 'cancelOrder').mockRejectedValue(apiError(409, 'OFFER_CLOSED'));
    await user.click(button('예약 취소하기'));

    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: '예약 취소' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '주문이 마감됐거나 취소된 제안이에요.',
    );
    expect(await screen.findByText('확정됐어요. 이제 새로 주문할 수 없어요')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('400 VALIDATION_ERROR: "내 동네 제안에만 주문할 수 있어요." 를 보이고 화면은 그대로다', async () => {
    const user = userEvent.setup();
    await openDetail(SEED_OPEN);
    vi.spyOn(orderService, 'createOrder').mockRejectedValue(apiError(400, 'VALIDATION_ERROR'));
    const reload = vi.spyOn(myRequestService, 'getResidentOffer');

    await user.click(button(/^선주문하기/));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '내 동네 제안에만 주문할 수 있어요.',
    );
    expect(button(/^선주문하기/)).toBeEnabled();
    expect(reload).not.toHaveBeenCalled();
  });

  it('404 NOT_FOUND: 사라진 제안 화면과 내 요청으로 돌아가는 링크', async () => {
    const user = userEvent.setup();
    await openDetail(SEED_OPEN);
    vi.spyOn(orderService, 'createOrder').mockRejectedValue(apiError(404, 'NOT_FOUND'));

    await user.click(button(/^선주문하기/));

    expect(await screen.findByText('취소되었거나 사라진 제안이에요')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '내 요청으로' })).toHaveAttribute(
      'href',
      '/resident/requests',
    );
    expect(queryButton(/^선주문하기/)).not.toBeInTheDocument();
  });

  it('403 FORBIDDEN(예약 취소): "내 예약이 아니라서 처리할 수 없어요." 를 보인다', async () => {
    const user = userEvent.setup();
    await openDetail(SEED_RESERVED);
    vi.spyOn(orderService, 'cancelOrder').mockRejectedValue(apiError(403, 'FORBIDDEN'));
    await user.click(button('예약 취소하기'));

    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: '예약 취소' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '내 예약이 아니라서 처리할 수 없어요.',
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('네트워크 오류는 기존 문구를 보이고 다시 시도할 수 있다', async () => {
    const user = userEvent.setup();
    await openDetail(SEED_OPEN);
    vi.spyOn(orderService, 'createOrder').mockRejectedValueOnce(
      new ApiError({ kind: 'network', message: 'x' }),
    );

    await user.click(button(/^선주문하기/));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '네트워크 연결을 확인하고 다시 시도해 주세요.',
    );
    await user.click(button(/^선주문하기/));
    expect(await screen.findByText('내 예약: 1개')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('데모 세션 차단(DEMO_SESSION)은 데모 안내 문구를 보인다', async () => {
    const user = userEvent.setup();
    await openDetail(SEED_OPEN);
    vi.spyOn(orderService, 'createOrder').mockRejectedValue(
      new ApiError({ kind: 'parse', code: 'DEMO_SESSION', message: 'x' }),
    );

    await user.click(button(/^선주문하기/));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '데모 계정은 사장님 화면만 볼 수 있어요',
    );
  });
});

describe('사라진 제안', () => {
  it('목록에 없는 id 이면 안내와 내 요청 링크가 보이고 주문 화면은 없다', async () => {
    renderApp(['/resident/offers/nope']);

    expect(await screen.findByText('취소되었거나 사라진 제안이에요')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '내 요청으로' })).toHaveAttribute(
      'href',
      '/resident/requests',
    );
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(queryButton(/선주문|예약 취소/)).not.toBeInTheDocument();
  });

  it('목록을 불러오지 못하면 오류 안내를 보인다', async () => {
    vi.spyOn(myRequestService, 'getResidentOffer').mockRejectedValue(new Error('x'));
    renderApp([`/resident/offers/${SEED_OPEN}`]);

    expect(await screen.findByText('제안을 가져오지 못했어요')).toBeInTheDocument();
  });

  it('다시 불러왔더니 사라졌으면(사장님이 취소) 사라진 제안 화면이 된다', async () => {
    const user = userEvent.setup();
    await openDetail(SEED_OPEN);
    dbOffer(SEED_OPEN).status = 'CLOSED';
    getDb().requests[0]!.offers = getDb().requests[0]!.offers!.filter((o) => o.id !== SEED_OPEN);
    vi.spyOn(orderService, 'createOrder').mockRejectedValue(apiError(409, 'OFFER_CLOSED'));

    await user.click(button(/^선주문하기/));

    expect(await screen.findByText('취소되었거나 사라진 제안이에요')).toBeInTheDocument();
  });
});

describe('주문 상태가 목록에도 반영된다', () => {
  it('선주문 뒤 내 요청의 제안(myOrder)이 같은 값이다', async () => {
    const user = userEvent.setup();
    await openDetail(SEED_OPEN);
    await user.click(button(/^선주문하기/));
    await screen.findByText('내 예약: 1개');

    const [item] = await myRequestService.listMyRequests();
    const offer = item!.offers.find((o) => o.id === SEED_OPEN);
    expect(offer?.myOrder).toMatchObject({
      quantity: 1,
      status: 'RESERVED',
    } satisfies Partial<MyOrder>);
    expect(offer?.orderCount).toBe(9);
  });
});
