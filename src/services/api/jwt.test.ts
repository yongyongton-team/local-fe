import { describe, expect, it } from 'vitest';
import { fakeJwt } from '@/test/apiStub';
import { readJwtTimes } from './jwt';

describe('readJwtTimes', () => {
  it('페이로드의 exp 와 iat 를 읽는다', () => {
    expect(readJwtTimes(fakeJwt({ exp: 1700003600, iat: 1700000000 }))).toEqual({
      exp: 1700003600,
      iat: 1700000000,
    });
  });

  it('없는 클레임은 빠진다', () => {
    expect(readJwtTimes(fakeJwt({ exp: 10 }))).toEqual({ exp: 10 });
    expect(readJwtTimes(fakeJwt({}))).toEqual({});
  });

  it.each(['', 'abc', 'a.b.c', 'a..c', 'a.%%%.c'])(
    '토큰이 아니거나 깨져 있으면(%j) 빈 객체다',
    (token) => {
      expect(readJwtTimes(token)).toEqual({});
    },
  );
});
