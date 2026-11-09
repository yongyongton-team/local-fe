/*
 * 서버 제안(offer)·주문(order) 상태를 화면에서 어떻게 다룰지 정하는 규칙을 한 곳에 모은다.
 *
 * 값과 뜻의 출처: 백엔드 API 명세. offer.status — OPEN(주문 받는 중) / CONFIRMED(최소 주문 수를 채움) /
 * CLOSED(마감됐는데 못 채움) / CANCELLED(사장님이 취소) / DONE(수령 끝). 서버는 GET /me/requests 의 offers 에서
 * CANCELLED 만 빼고 준다. 주문 상태 RESERVED / CANCELLED / PICKED_UP 의 뜻은 명세에서 확인하지 못했다.
 * 내 요청 화면은 "사장님 응답" 한 줄(업체·지역·제안 제목)만 보여주므로 상태 문구를 넣을 자리는 없다.
 */

export const KNOWN_OFFER_STATUSES = ['OPEN', 'CONFIRMED', 'CLOSED', 'CANCELLED', 'DONE'] as const;
export type OfferStatus = (typeof KNOWN_OFFER_STATUSES)[number];

export const KNOWN_ORDER_STATUSES = ['RESERVED', 'CANCELLED', 'PICKED_UP'] as const;
export type OrderStatus = (typeof KNOWN_ORDER_STATUSES)[number];

/** "사장님 응답"으로 보여주는 제안 상태(명세 기준): 주문을 받는 중(OPEN)이거나 최소 주문 수를 채운(CONFIRMED) 제안. */
export const SHOWN_OFFER_STATUSES: readonly OfferStatus[] = ['OPEN', 'CONFIRMED'];

/** 보여주지 않는 제안 상태: 마감(CLOSED), 수령 끝(DONE), 취소(CANCELLED). 모르는 값도 보여주지 않는다. */
export const HIDDEN_OFFER_STATUSES: readonly OfferStatus[] = KNOWN_OFFER_STATUSES.filter(
  (status) => !SHOWN_OFFER_STATUSES.includes(status),
);

/** 서버 제안 상태 → 알려진 값. 모르는 값이거나 문자열이 아니면 null. */
export function toOfferStatus(raw: unknown): OfferStatus | null {
  return KNOWN_OFFER_STATUSES.find((status) => status === raw) ?? null;
}

/** 서버 주문 상태 → 알려진 값. 모르는 값이면 null. 지금 화면은 주문 상태를 쓰지 않는다. */
export function toOrderStatus(raw: unknown): OrderStatus | null {
  return KNOWN_ORDER_STATUSES.find((status) => status === raw) ?? null;
}

/** 이 제안을 "사장님 응답"으로 보여줄지. OPEN·CONFIRMED 만 보이고, 그 밖의 상태(알 수 없는 값·없음 포함)는 보이지 않는다. */
export function isShownOfferStatus(raw: unknown): boolean {
  const status = toOfferStatus(raw);
  return status !== null && SHOWN_OFFER_STATUSES.includes(status);
}
