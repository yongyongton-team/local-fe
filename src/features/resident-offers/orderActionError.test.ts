import { describe, expect, it } from 'vitest';
import { ApiError } from '@/services/api/apiError';
import { describeOrderError } from './orderActionError';

const http = (status: number, code?: string) =>
  new ApiError({ kind: 'http', status, ...(code !== undefined && { code }), message: 'x' });

describe('describeOrderError', () => {
  it.each([
    [
      '409 ALREADY_ORDERED',
      http(409, 'ALREADY_ORDERED'),
      'alreadyOrdered',
      '이미 선주문한 제안이에요.',
    ],
    [
      '409 OFFER_CLOSED',
      http(409, 'OFFER_CLOSED'),
      'closed',
      '주문이 마감됐거나 취소된 제안이에요.',
    ],
    [
      '400 VALIDATION_ERROR',
      http(400, 'VALIDATION_ERROR'),
      'validation',
      '내 동네 제안에만 주문할 수 있어요.',
    ],
    ['404 NOT_FOUND', http(404, 'NOT_FOUND'), 'notFound', '취소되었거나 사라진 제안이에요.'],
    ['403 FORBIDDEN', http(403, 'FORBIDDEN'), 'forbidden', '내 예약이 아니라서 처리할 수 없어요.'],
    ['코드 없는 403', http(403), 'forbidden', '내 예약이 아니라서 처리할 수 없어요.'],
    ['코드 없는 404', http(404), 'notFound', '취소되었거나 사라진 제안이에요.'],
  ])('%s → 종류와 문구', (_name, error, kind, message) => {
    expect(describeOrderError(error)).toEqual({ kind, message });
  });

  it('그 밖의 오류는 기존 describeApiError 문구다', () => {
    expect(describeOrderError(new ApiError({ kind: 'network', message: 'x' }))).toMatchObject({
      kind: 'other',
      message: '네트워크 연결을 확인하고 다시 시도해 주세요.',
    });
    expect(describeOrderError(http(500))).toMatchObject({
      kind: 'other',
      message: '일시적인 문제가 생겼어요. 잠시 후 다시 시도해 주세요.',
    });
    expect(describeOrderError(new Error('x'))).toMatchObject({ kind: 'other' });
  });

  it('응답을 해석하지 못한 parse 오류는 결과를 알 수 없는 오류로 다룬다', () => {
    expect(describeOrderError(new ApiError({ kind: 'parse', message: 'x' })).kind).toBe('unknown');
  });

  it('데모 세션 차단과 숫자가 아닌 id 는 unknown 이 아니다(요청이 나가지 않았다)', () => {
    expect(
      describeOrderError(new ApiError({ kind: 'parse', code: 'DEMO_SESSION', message: 'x' })).kind,
    ).toBe('other');
    expect(
      describeOrderError(new ApiError({ kind: 'parse', code: 'INVALID_ID', message: 'x' })).kind,
    ).toBe('other');
  });
});
