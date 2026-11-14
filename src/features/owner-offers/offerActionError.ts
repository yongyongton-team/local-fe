import { describeApiError, isApiError } from '@/services';
import { OFFER_COPY } from './copy';

/** 판매 끝·제안 취소 오류의 종류. 화면이 종류에 따라 다시 불러오거나 "찾을 수 없음"을 보인다. */
export type OfferActionErrorKind = 'closed' | 'forbidden' | 'notFound' | 'other';

export interface OfferActionError {
  kind: OfferActionErrorKind;
  /** 화면에 보일 문구. 서버가 보낸 message 는 쓰지 않는다. */
  message: string;
}

/**
 * 판매 끝·제안 취소(POST /offers/{id}/done·cancel)의 오류를 화면 문구로 바꾼다.
 * - 409 OFFER_CLOSED: 그 상태에서는 처리할 수 없다(마감 시각이 지나 상태가 바뀐 경우가 흔하다). 화면이 서버 상태로 다시 불러온다.
 * - 403 FORBIDDEN: 내 제안이 아니다. 404 NOT_FOUND: 없는 제안이다.
 * - 그 밖(네트워크·시간 초과·5xx 등)은 기존 describeApiError 문구다(맥락 문구는 제안 작성 전용이라 쓰지 않는다).
 */
export function describeOfferActionError(error: unknown): OfferActionError {
  if (isApiError(error) && error.kind === 'http') {
    if (error.code === 'OFFER_CLOSED') return { kind: 'closed', message: OFFER_COPY.actionClosed };
    if (error.code === 'FORBIDDEN' || (error.code === undefined && error.status === 403)) {
      return { kind: 'forbidden', message: OFFER_COPY.actionForbidden };
    }
    if (error.code === 'NOT_FOUND' || (error.code === undefined && error.status === 404)) {
      return { kind: 'notFound', message: OFFER_COPY.detailNotFoundTitle };
    }
  }
  return { kind: 'other', message: describeApiError(error) };
}
