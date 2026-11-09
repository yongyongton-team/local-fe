import { describe, expect, it } from 'vitest';
import { isApiError } from './apiError';
import { toDomainId, toServerId } from './ids';

const invalid = (action: () => unknown) => {
  try {
    action();
  } catch (error) {
    expect(isApiError(error)).toBe(true);
    expect(error).toMatchObject({ kind: 'parse', code: 'INVALID_ID' });
    return;
  }
  throw new Error('INVALID_ID 오류여야 해요');
};

describe('toDomainId (서버 숫자 id → 도메인 문자열)', () => {
  it('양의 정수를 문자열로 바꾼다', () => {
    expect(toDomainId(28)).toBe('28');
    expect(toDomainId(1)).toBe('1');
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 60, '28', null, undefined, {}])(
    '%j 는 오류다',
    (value) => invalid(() => toDomainId(value)),
  );
});

describe('toServerId (도메인 문자열 id → 서버 숫자)', () => {
  it('숫자로만 된 문자열을 숫자로 바꾼다', () => {
    expect(toServerId('28')).toBe(28);
    expect(toServerId('39')).toBe(39);
  });

  it.each([
    'guseong',
    '',
    ' 28',
    '28 ',
    '0',
    '028',
    '-3',
    '1.5',
    '1e3',
    '28a',
    '99999999999999999999',
  ])('%j 는 오류다(slug·공백·소수·너무 큰 값)', (value) => invalid(() => toServerId(value)));

  it('왕복하면 같은 값이다', () => {
    expect(toServerId(toDomainId(12))).toBe(12);
  });
});
