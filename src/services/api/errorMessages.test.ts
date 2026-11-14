import { describe, expect, it } from 'vitest';
import {
  ApiError,
  KNOWN_ERROR_CODES,
  isKnownErrorCode,
  type ApiErrorCode,
  type ApiErrorKind,
} from './apiError';
import {
  ERROR_MESSAGES_BY_CODE,
  FALLBACK_ERROR_MESSAGE,
  NOT_FOUND_MESSAGES_BY_CONTEXT,
  VALIDATION_MESSAGES_BY_CONTEXT,
  describeApiError,
  type ErrorContext,
} from './errorMessages';

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

  it('FORBIDDEN 은 역할 재선택 안내 문구다', () => {
    const expected =
      '이 화면을 볼 수 있는 역할이 아니에요. 처음 화면에서 역할을 다시 선택해 주세요.';
    expect(describeApiError(http(403, 'FORBIDDEN'))).toBe(expected);
    expect(ERROR_MESSAGES_BY_CODE.FORBIDDEN).toBe(expected);
    // 서버가 보낸 message 는 쓰지 않는다.
    expect(describeApiError(http(403, 'FORBIDDEN', '서버 원문'))).toBe(expected);
  });

  it('ALREADY_REQUESTED 와 AI_UNAVAILABLE 은 코드별 문구이고 서버 message 는 쓰지 않는다', () => {
    const already = '이 동네에 같은 업종을 이미 요청했어요. 내 요청에서 확인해 보세요.';
    const ai = '요청 내용을 정리하지 못했어요. 업종을 직접 골라 주세요.';
    expect(describeApiError(http(409, 'ALREADY_REQUESTED', '서버 원문'))).toBe(already);
    expect(describeApiError(http(502, 'AI_UNAVAILABLE', '서버 원문'))).toBe(ai);
    expect(ERROR_MESSAGES_BY_CODE.ALREADY_REQUESTED).toBe(already);
    expect(ERROR_MESSAGES_BY_CODE.AI_UNAVAILABLE).toBe(ai);
  });

  it('문구가 아직 없는 코드는 마지막 문구다', () => {
    for (const [status, code] of [
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

  it('5xx 는 마지막 문구다(502 AI_UNAVAILABLE 만 예외로 코드별 문구)', () => {
    expect(describeApiError(http(500, 'VALIDATION_ERROR'))).toBe(FALLBACK_ERROR_MESSAGE);
    expect(describeApiError(http(502, 'AI_UNAVAILABLE'))).toBe(
      ERROR_MESSAGES_BY_CODE.AI_UNAVAILABLE,
    );
    expect(describeApiError(http(502, 'SOMETHING_ELSE'))).toBe(FALLBACK_ERROR_MESSAGE);
    expect(describeApiError(http(502))).toBe(FALLBACK_ERROR_MESSAGE);
    expect(describeApiError(http(500, 'ALREADY_REQUESTED'))).toBe(FALLBACK_ERROR_MESSAGE);
    expect(describeApiError(http(503))).toBe(FALLBACK_ERROR_MESSAGE);
    expect(describeApiError(http(500, 'FORBIDDEN'))).toBe(FALLBACK_ERROR_MESSAGE);
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

describe('describeApiError: 맥락별 VALIDATION_ERROR 문구', () => {
  const GENERIC = ERROR_MESSAGES_BY_CODE.VALIDATION_ERROR;
  const CONTEXTS = [
    ['offer', '입력한 값을 확인해 주세요. 날짜 순서와 가게 정보도 확인해 주세요.'],
    ['request', '요청 내용을 다시 확인해 주세요. 시간대와 이용 빈도를 선택했는지 살펴봐 주세요.'],
    ['shop', '가게 정보를 다시 확인해 주세요. 가게 이름, 업종, 위치를 살펴봐 주세요.'],
    ['parse', '요청 문장을 다시 확인해 주세요.'],
  ] as const satisfies readonly (readonly [ErrorContext, string])[];

  it.each(CONTEXTS)('%s 맥락이면 그 맥락의 문구다', (context, expected) => {
    expect(describeApiError(http(400, 'VALIDATION_ERROR'), context)).toBe(expected);
    expect(VALIDATION_MESSAGES_BY_CONTEXT[context]).toBe(expected);
  });

  it('맥락을 주지 않으면 기존 문구 그대로다(내 정보 저장·동네 선택)', () => {
    expect(describeApiError(http(400, 'VALIDATION_ERROR'))).toBe(GENERIC);
    expect(describeApiError(http(400, 'VALIDATION_ERROR'), undefined)).toBe(GENERIC);
  });

  it('맥락 문구는 서로 다르고 기존 문구와도 다르다', () => {
    const all = [GENERIC, ...CONTEXTS.map(([, text]) => text)];
    expect(new Set(all).size).toBe(all.length);
  });

  it('코드가 없는 400 도 VALIDATION_ERROR 로 보고 맥락 문구를 쓴다', () => {
    expect(describeApiError(http(400), 'offer')).toBe(VALIDATION_MESSAGES_BY_CONTEXT.offer);
  });

  it('서버 message 는 맥락이 있어도 쓰지 않는다', () => {
    const text = describeApiError(
      http(400, 'VALIDATION_ERROR', '서버 원문 가격은 음수일 수 없음'),
      'offer',
    );

    expect(text).not.toContain('서버 원문');
    expect(text).toBe(VALIDATION_MESSAGES_BY_CONTEXT.offer);
  });

  it('VALIDATION_ERROR·NOT_FOUND 가 아닌 오류의 문구와 동작은 맥락과 상관없이 그대로다', () => {
    for (const [context] of CONTEXTS) {
      expect(describeApiError(http(403, 'FORBIDDEN'), context)).toBe(
        ERROR_MESSAGES_BY_CODE.FORBIDDEN,
      );
      expect(describeApiError(http(401, 'UNAUTHORIZED'), context)).toBe(
        ERROR_MESSAGES_BY_CODE.UNAUTHORIZED,
      );
      expect(describeApiError(http(409, 'ALREADY_REQUESTED'), context)).toBe(
        ERROR_MESSAGES_BY_CODE.ALREADY_REQUESTED,
      );
      expect(describeApiError(http(502, 'AI_UNAVAILABLE'), context)).toBe(
        ERROR_MESSAGES_BY_CODE.AI_UNAVAILABLE,
      );
      expect(describeApiError(http(500), context)).toBe(FALLBACK_ERROR_MESSAGE);
      expect(describeApiError(of('network'), context)).toBe(describeApiError(of('network')));
      expect(describeApiError(of('timeout'), context)).toBe(describeApiError(of('timeout')));
      expect(describeApiError(of('parse'), context)).toBe(FALLBACK_ERROR_MESSAGE);
      expect(describeApiError(new Error('x'), context)).toBe(FALLBACK_ERROR_MESSAGE);
    }
  });

  it('5xx 는 VALIDATION_ERROR 코드여도 마지막 문구다(맥락과 상관없이)', () => {
    expect(describeApiError(http(500, 'VALIDATION_ERROR'), 'offer')).toBe(FALLBACK_ERROR_MESSAGE);
  });
});

describe('describeApiError: 맥락별 NOT_FOUND 문구', () => {
  const GENERIC = ERROR_MESSAGES_BY_CODE.NOT_FOUND;
  const CONTEXTS = [
    ['offer', '제안할 동네나 업종을 찾을 수 없어요. 다시 선택해 주세요.'],
    ['request', '요청할 동네나 업종을 찾을 수 없어요. 다시 선택해 주세요.'],
    ['shop', '선택한 업종이나 동네를 찾을 수 없어요. 다시 선택해 주세요.'],
    ['parse', '요청을 정리할 동네를 찾을 수 없어요. 다시 선택해 주세요.'],
  ] as const satisfies readonly (readonly [ErrorContext, string])[];

  it.each(CONTEXTS)('%s 맥락이면 그 맥락의 문구다(대상을 단정하지 않는다)', (context, expected) => {
    expect(describeApiError(http(404, 'NOT_FOUND'), context)).toBe(expected);
    expect(NOT_FOUND_MESSAGES_BY_CONTEXT[context]).toBe(expected);
    expect(expected).toContain('동네');
  });

  it('맥락을 주지 않으면 기존 문구 그대로다', () => {
    expect(describeApiError(http(404, 'NOT_FOUND'))).toBe(GENERIC);
    expect(GENERIC).toBe('선택한 동네를 찾을 수 없어요. 다른 동네를 선택해 주세요.');
  });

  it('코드가 없는 404 도 NOT_FOUND 로 보고, 서버 message 는 쓰지 않는다', () => {
    const text = describeApiError(http(404, undefined, '서버 원문 없는 업종'), 'shop');

    expect(text).toBe(NOT_FOUND_MESSAGES_BY_CONTEXT.shop);
    expect(text).not.toContain('서버 원문');
  });

  it('맥락 문구는 서로 다르고 기존 문구, 검증 문구와도 다르다', () => {
    const all = [
      GENERIC,
      ...CONTEXTS.map(([, text]) => text),
      ...Object.values(VALIDATION_MESSAGES_BY_CONTEXT),
    ];
    expect(new Set(all).size).toBe(all.length);
  });

  it('5xx 는 NOT_FOUND 코드여도 마지막 문구다', () => {
    expect(describeApiError(http(500, 'NOT_FOUND'), 'shop')).toBe(FALLBACK_ERROR_MESSAGE);
  });
});
