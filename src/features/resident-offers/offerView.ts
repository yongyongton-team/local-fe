import { formatMonthDay24h } from '@/shared/lib/kstDate';
import type { MerchantResponse, MyOrder, ResidentOffer } from '@/types/domain';
import { buildOfferRows, type OfferRowData } from '@/features/owner-offers/offerView';
import { OFFER_COPY } from '@/features/owner-offers/copy';
import { RESIDENT_OFFER_COPY } from './copy';

/** 서버가 받는 선주문 수량 범위(POST /offers/{id}/orders) */
export const MIN_QUANTITY = 1;
export const MAX_QUANTITY = 10;

/** 수량을 1~10 의 정수로 맞춘다. 숫자가 아니면 1. */
export function clampQuantity(value: number): number {
  if (!Number.isFinite(value)) return MIN_QUANTITY;
  return Math.min(MAX_QUANTITY, Math.max(MIN_QUANTITY, Math.trunc(value)));
}

/** 금액 = 가격 × 수량. 천 단위 쉼표를 붙인다(예: 30,000). */
export function formatOrderAmount(price: number, quantity: number): string {
  return (price * quantity).toLocaleString('ko-KR');
}

const isShown = (offer: Pick<ResidentOffer, 'status'>) =>
  offer.status === 'OPEN' || offer.status === 'CONFIRMED';

/** 서버 순서의 첫 OPEN·CONFIRMED 제안. 내 요청 카드의 "사장님 응답"이 가리키는 제안이다. 없으면 undefined. */
export function pickLinkedOffer(offers: readonly ResidentOffer[]): ResidentOffer | undefined {
  return offers.find(isShown);
}

/**
 * 카드의 "사장님 응답"이 같은 제안으로 이어지는지. 카드 문구(response)는 offers 보다 느슨한 규칙으로 만들어져
 * 형식이 틀려 offers 에서 빠진 제안으로도 만들어진다. 그 제안은 상세가 없으므로 링크를 만들지 않는다.
 * 응답에는 제안 id 가 없어서 업체 이름·수령 시각·받는 곳이 같은 제안일 때만 연결한다.
 */
export function linkedOfferFor(
  response: MerchantResponse | undefined,
  offers: readonly ResidentOffer[],
): ResidentOffer | undefined {
  const offer = pickLinkedOffer(offers);
  if (!response || !offer) return undefined;
  const samePlace = (response.pickupPlace ?? '') === offer.pickupPlace.trim();
  const sameTime = response.pickupAt?.getTime() === offer.pickupAt.getTime();
  return response.merchantName === offer.shopName && sameTime && samePlace ? offer : undefined;
}

/** 상태 줄의 마감 문구. 예: 마감 11/14(토) 18:00 */
export function buildDeadlineText(offer: Pick<ResidentOffer, 'deadlineAt'>): string {
  return OFFER_COPY.deadlineText(formatMonthDay24h(offer.deadlineAt));
}

export interface ResidentRowData {
  key: OfferRowData['key'] | 'pickupPlace';
  label: string;
  value: string;
}

/** 가격·받는 날·마감·받는 곳 행. 값이 없는 행(받는 곳이 빈 문자열)은 만들지 않는다. */
export function buildResidentRows(offer: ResidentOffer): ResidentRowData[] {
  const rows: ResidentRowData[] = buildOfferRows(offer);
  if (offer.pickupPlace !== '') {
    rows.push({ key: 'pickupPlace', label: OFFER_COPY.rowPickupPlace, value: offer.pickupPlace });
  }
  return rows;
}

export interface Recruitment {
  /** 0~1. 최소 주문 수를 넘으면 가득(1) */
  ratio: number;
  text: string;
  valueNow: number;
  valueMax: number;
  filled: boolean;
}

/** 「모집 현황」 막대: 예약 수 ÷ 최소 주문 수(1 을 넘지 않는다). */
export function buildRecruitment(
  offer: Pick<ResidentOffer, 'orderCount' | 'minOrders'>,
): Recruitment {
  const { orderCount, minOrders } = offer;
  const filled = orderCount >= minOrders;
  return {
    ratio: minOrders > 0 ? Math.min(1, Math.max(0, orderCount / minOrders)) : 1,
    text: filled
      ? RESIDENT_OFFER_COPY.recruitFilled(orderCount, minOrders)
      : RESIDENT_OFFER_COPY.recruitMore(orderCount, minOrders, minOrders - orderCount),
    valueNow: orderCount,
    valueMax: minOrders,
    filled,
  };
}

/**
 * 화면의 아래쪽 모양.
 * - order: OPEN 이고 내 주문이 없다 → 수량 선택 + 「선주문하기」
 * - reserved: OPEN 이고 주문이 RESERVED → "내 예약: N개" + 「예약 취소하기」
 * - readOnly: 버튼이 없다. note 는 상태 안내(받아 갔으면 "받아 갔어요"), reservedQuantity 가 있으면 "내 예약: N개"도 보인다.
 */
export type OrderMode =
  | { kind: 'order' }
  | { kind: 'reserved'; order: MyOrder }
  | { kind: 'readOnly'; note: string | null; reservedQuantity?: number };

export function resolveOrderMode(offer: Pick<ResidentOffer, 'status' | 'myOrder'>): OrderMode {
  const { status, myOrder } = offer;
  if (myOrder?.status === 'PICKED_UP') {
    return { kind: 'readOnly', note: RESIDENT_OFFER_COPY.pickedUp };
  }
  if (status === 'OPEN') {
    return myOrder?.status === 'RESERVED'
      ? { kind: 'reserved', order: myOrder }
      : { kind: 'order' };
  }
  const note =
    status === 'CONFIRMED'
      ? RESIDENT_OFFER_COPY.statusNote.confirmed
      : status === 'CLOSED'
        ? RESIDENT_OFFER_COPY.statusNote.closed
        : status === 'DONE'
          ? RESIDENT_OFFER_COPY.statusNote.done
          : null;
  return {
    kind: 'readOnly',
    note,
    ...(myOrder?.status === 'RESERVED' && { reservedQuantity: myOrder.quantity }),
  };
}
