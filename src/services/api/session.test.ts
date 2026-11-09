import { describe, expect, it } from 'vitest';
import { fakeJwt } from '@/test/apiStub';
import { EXPIRES_IN_UNIT_MS, EXPIRY_MARGIN_MS, resolveExpiresAt } from './session';

describe('resolveExpiresAt', () => {
  const now = 1_700_000_000_000;

  it('JWT 의 exp(초)를 우선하고 여유 시간을 뺀다', () => {
    const exp = now / 1000 + 7200;

    expect(resolveExpiresAt(fakeJwt({ exp }), 1, now)).toBe(exp * 1000 - EXPIRY_MARGIN_MS);
  });

  it('exp 를 읽을 수 없으면 expiresIn × 단위로 계산한다', () => {
    expect(resolveExpiresAt('not-a-jwt', 600, now)).toBe(
      now + 600 * EXPIRES_IN_UNIT_MS - EXPIRY_MARGIN_MS,
    );
  });

  it('둘 다 없으면 undefined(서버가 401 로 알려 줄 때까지 쓴다)', () => {
    expect(resolveExpiresAt('not-a-jwt', undefined, now)).toBeUndefined();
    expect(resolveExpiresAt('not-a-jwt', null, now)).toBeUndefined();
    expect(resolveExpiresAt('not-a-jwt', Number.NaN, now)).toBeUndefined();
  });
});
