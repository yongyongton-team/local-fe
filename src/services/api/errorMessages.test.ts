import { describe, expect, it } from 'vitest';
import {
  ApiError,
  KNOWN_ERROR_CODES,
  isKnownErrorCode,
  type ApiErrorCode,
  type ApiErrorKind,
} from './apiError';
import { ERROR_MESSAGES_BY_CODE, FALLBACK_ERROR_MESSAGE, describeApiError } from './errorMessages';

const http = (status: number, code?: ApiErrorCode, message = '서버가 준 문구'): ApiError =>
  new ApiError({ kind: 'http', status, code, message });
const of = (kind: ApiErrorKind) => new ApiError({ kind, message: 'x' });

describe('오류 코드 타입', () => {
  it('백엔드 합의 표의 8개 코드를 알고 있고, 모르는 코드도 담을 수 있다', () => {
    expect([...KNOWN_ERROR_CODES]).toEqual([
      'VALIDATION_ERROR',
      'UNAUTHORIZED',
      'FORBIDDEN',
      'NOT_FOUND',
      'ALREADY_REQUESTED',
      'ALREADY_ORDERED',
      'OFFER_CLOSED',
      'AI_UNAVAILABLE',
    ]);
    expect(isKnownErrorCode('NOT_FOUND')).toBe(true);
    expect(isKnownErrorCode('SOMETHING_NEW')).toBe(false);
    expect(isKnownErrorCode(undefined)).toBe(false);
    // 서버가 모르는 코드를 보내도 ApiError 로 만들어진다.
    expect(http(418, 'TEAPOT').code).toBe('TEAPOT');
  });
});

describe('describeApiError', () => {
  it('network 와 timeout 은 종류로 구분한다', () => {
    expect(describeApiError(of('network'))).toBe('네트워크 연결을 확인하고 다시 시도해 주세요.');
    expect(describeApiError(of('timeout'))).toBe(
      '응답이 늦어지고 있어요. 잠시 후 다시 시도해 주세요.',
    );
    expect(describeApiError(of('network'))).not.toBe(describeApiError(of('timeout')));
  });

  it.each([
    ['VALIDATION_ERROR', 400, '선택한 정보를 확인하지 못했어요. 역할과 동네를 다시 선택해 주세요.'],
    ['NOT_FOUND', 404, '선택한 동네를 찾을 수 없어요. 다른 동네를 선택해 주세요.'],
    ['UNAUTHORIZED', 401, '로그인 상태를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.'],
  ] as const)('%s 는 코드별 문구다', (code, status, expected) => {
    expect(describeApiError(http(status, code))).toBe(expected);
    expect(ERROR_MESSAGES_BY_CODE[code]).toBe(expected);
  });

  it('FORBIDDEN 과 문구가 아직 없는 코드는 마지막 문구다', () => {
    for (const [status, code] of [
      [403, 'FORBIDDEN'],
      [409, 'ALREADY_REQUESTED'],
      [409, 'ALREADY_ORDERED'],
      [409, 'OFFER_CLOSED'],
    ] as const) {
      expect(describeApiError(http(status, code))).toBe(FALLBACK_ERROR_MESSAGE);
    }
    expect(FALLBACK_ERROR_MESSAGE).toBe('일시적인 문제가 생겼어요. 잠시 후 다시 시도해 주세요.');
  });

  it('알 수 없는 코드는 마지막 문구다', () => {
    expect(describeApiError(http(400, 'SOMETHING_NEW'))).toBe(FALLBACK_ERROR_MESSAGE);
    expect(describeApiError(http(422, 'TEAPOT'))).toBe(FALLBACK_ERROR_MESSAGE);
  });

  it('5xx 는 코드와 무관하게 마지막 문구다', () => {
    expect(describeApiError(http(500, 'VALIDATION_ERROR'))).toBe(FALLBACK_ERROR_MESSAGE);
    expect(describeApiError(http(502, 'AI_UNAVAILABLE'))).toBe(FALLBACK_ERROR_MESSAGE);
    expect(describeApiError(http(503))).toBe(FALLBACK_ERROR_MESSAGE);
  });

  it('본문에 code 가 없으면(게이트웨이 HTML 등) 400·401·404 는 상태 코드로 문구를 고른다', () => {
    expect(describeApiError(http(404))).toBe(ERROR_MESSAGES_BY_CODE.NOT_FOUND);
    expect(describeApiError(http(401))).toBe(ERROR_MESSAGES_BY_CODE.UNAUTHORIZED);
    expect(describeApiError(http(400))).toBe(ERROR_MESSAGES_BY_CODE.VALIDATION_ERROR);
    expect(describeApiError(http(418))).toBe(FALLBACK_ERROR_MESSAGE);
  });

  it('알 수 없는 코드가 있으면 상태 코드로 추측하지 않는다', () => {
    expect(describeApiError(http(404, 'SOMETHING_NEW'))).toBe(FALLBACK_ERROR_MESSAGE);
  });

  it('parse 오류와 ApiError 가 아닌 오류는 마지막 문구다', () => {
    expect(describeApiError(of('parse'))).toBe(FALLBACK_ERROR_MESSAGE);
    expect(describeApiError(new Error('boom'))).toBe(FALLBACK_ERROR_MESSAGE);
    expect(describeApiError(undefined)).toBe(FALLBACK_ERROR_MESSAGE);
    expect(describeApiError('x')).toBe(FALLBACK_ERROR_MESSAGE);
  });

  it('서버 message 는 문구에 쓰이지 않는다', () => {
    const text = describeApiError(http(404, 'NOT_FOUND', '존재하지 않는 동입니다 (서버 문구)'));

    expect(text).not.toContain('서버 문구');
    expect(text).not.toContain('존재하지 않는 동입니다');
  });
});
