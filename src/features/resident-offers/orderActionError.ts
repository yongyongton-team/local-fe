import { ORDER_MESSAGES_BY_CODE, describeApiError, isApiError } from '@/services';

/**
 * 선주문·예약 취소 오류의 종류. 화면이 종류에 따라 서버 상태를 다시 불러오거나 "사라진 제안"을 보인다.
 * - alreadyOrdered(409 ALREADY_ORDERED), closed(409 OFFER_CLOSED): 문구를 보이고 다시 불러온다.
 * - notFound(404): 사라진 제안 화면. forbidden(403), validation(400): 문구만.
 * - unknown: 처리 결과를 알 수 없다(응답을 해석하지 못함). 문구를 보이고 다시 불러온다.
 */
export type OrderErrorKind =
  'alreadyOrdered' | 'closed' | 'notFound' | 'forbidden' | 'validation' | 'unknown' | 'other';

export interface OrderError {
  kind: OrderErrorKind;
  /** 화면에 보일 문구. 서버가 보낸 message 는 쓰지 않는다. */
  message: string;
}

const hasStatus = (error: { code?: string; status?: number }, code: string, status: number) =>
  error.code === code || (error.code === undefined && error.status === status);

export function describeOrderError(error: unknown): OrderError {
  const message = describeApiError(error, 'order');
  if (isApiError(error)) {
    if (error.kind === 'parse' && error.code !== 'DEMO_SESSION' && error.code !== 'INVALID_ID') {
      return { kind: 'unknown', message };
    }
    if (error.kind === 'http') {
      if (error.code === 'ALREADY_ORDERED') return { kind: 'alreadyOrdered', message };
      if (error.code === 'OFFER_CLOSED') return { kind: 'closed', message };
      if (hasStatus(error, 'NOT_FOUND', 404)) return { kind: 'notFound', message };
      if (hasStatus(error, 'FORBIDDEN', 403)) {
        // 403 이 코드 없이 오면 describeApiError 는 마지막 문구라 주문 맥락의 문구를 직접 쓴다.
        return { kind: 'forbidden', message: ORDER_MESSAGES_BY_CODE.FORBIDDEN ?? message };
      }
      if (hasStatus(error, 'VALIDATION_ERROR', 400)) return { kind: 'validation', message };
    }
  }
  return { kind: 'other', message };
}
