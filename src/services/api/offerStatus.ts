/*
 * 서버 제안(offer)·주문(order) 상태를 화면에서 어떻게 다룰지 정하는 규칙을 한 곳에 모은다.
 *
 * 값 목록은 OpenAPI 명세(ResidentOfferView.status, OrderView.status)에서 가져왔다. 각 값의 뜻은 명세에 없고,
 * 실서버 확인에서도 제안이 하나도 없어 값을 본 적이 없다(미확인). 그래서 값의 뜻을 추측해 문구를 만들지 않는다.
 * 내 요청 화면은 "사장님 응답" 한 줄(업체·지역·제안 제목)만 보여주므로 상태 문구를 넣을 자리도 없다.
 * 값의 뜻이 확인되어 문구가 필요해지면 이 파일에 표를 추가한다.
 */

export const KNOWN_OFFER_STATUSES = ['OPEN', 'CONFIRMED', 'CLOSED', 'CANCELLED', 'DONE'] as const;
export type OfferStatus = (typeof KNOWN_OFFER_STATUSES)[number];

export const KNOWN_ORDER_STATUSES = ['RESERVED', 'CANCELLED', 'PICKED_UP'] as const;
export type OrderStatus = (typeof KNOWN_ORDER_STATUSES)[number];

/**
 * [임시] "사장님 응답"으로 보여주지 않는 제안 상태. 취소된 제안은 주민에게 응답으로 보이면 안 된다고 보고 뺐다.
 * 나머지 알려진 상태(OPEN, CONFIRMED, CLOSED, DONE)는 뜻이 확인되지 않았지만 숨길 근거가 없어 보여준다.
 */
export const HIDDEN_OFFER_STATUSES: readonly OfferStatus[] = ['CANCELLED'];

/** 서버 제안 상태 → 알려진 값. 모르는 값이거나 문자열이 아니면 null. */
export function toOfferStatus(raw: unknown): OfferStatus | null {
  return KNOWN_OFFER_STATUSES.find((status) => status === raw) ?? null;
}

/** 서버 주문 상태 → 알려진 값. 모르는 값이면 null. 지금 화면은 주문 상태를 쓰지 않는다. */
export function toOrderStatus(raw: unknown): OrderStatus | null {
  return KNOWN_ORDER_STATUSES.find((status) => status === raw) ?? null;
}

/** 이 제안을 "사장님 응답"으로 보여줄지. 취소됐거나 알 수 없는 상태(없음 포함)는 보여주지 않는다. */
export function isShownOfferStatus(raw: unknown): boolean {
  const status = toOfferStatus(raw);
  return status !== null && !HIDDEN_OFFER_STATUSES.includes(status);
}
