import { beforeEach, describe, expect, it } from 'vitest';
import { jsonResponse, stubFetch } from '@/test/apiStub';
import { createApiClient } from './apiClient';
import { createApiMeService } from './apiMeService';
import { createTokenStore } from './tokenStore';

const NOW = 1_000_000;
const newService = () => {
  const client = createApiClient({
    baseUrl: 'https://api.test',
    store: createTokenStore(),
    now: () => NOW,
  });
  return createApiMeService(() => client);
};
const saveToken = (expiresAt = NOW + 1e7) =>
  localStorage.setItem('yyt.session', JSON.stringify({ token: 'tok-saved', expiresAt }));

const ME = {
  id: 3,
  nickname: '게스트',
  role: 'FOUNDER',
  dong: { id: 28, name: '보정동', gu: '기흥구' },
  shop: null,
};

beforeEach(() => localStorage.clear());

describe('createApiMeService 선택 복원', () => {
  it('토큰이 없으면 canRestoreSelection 은 false 이고 restoreSelection 은 요청 없이 null 이다', async () => {
    const { fn } = stubFetch(() => jsonResponse(200, ME));
    const service = newService();

    expect(service.canRestoreSelection()).toBe(false);
    await expect(service.restoreSelection()).resolves.toBeNull();
    expect(fn).not.toHaveBeenCalled();
  });

  it('만료된 토큰도 없는 것으로 본다', async () => {
    saveToken(NOW - 1);
    const { fn } = stubFetch(() => jsonResponse(200, ME));
    const service = newService();

    expect(service.canRestoreSelection()).toBe(false);
    await expect(service.restoreSelection()).resolves.toBeNull();
    expect(fn).not.toHaveBeenCalled();
  });

  it('토큰이 있으면 GET /me 한 번으로 역할과 동네(id 문자열, district=gu)를 돌려준다', async () => {
    saveToken();
    const { calls } = stubFetch(() => jsonResponse(200, ME));
    const service = newService();

    expect(service.canRestoreSelection()).toBe(true);
    await expect(service.restoreSelection()).resolves.toEqual({
      role: 'founder',
      neighborhood: { id: '28', district: '기흥구', name: '보정동' },
    });
    expect(calls.map((c) => [c.method, c.path, c.authorization])).toEqual([
      ['GET', '/api/v1/me', 'Bearer tok-saved'],
    ]);
  });

  it('role·dong 이 없거나 알 수 없는 role 이면 null 이고, 실패는 ApiError 로 던진다', async () => {
    saveToken();
    for (const over of [{ role: null }, { dong: null }, { role: 'ADMIN' }]) {
      stubFetch(() => jsonResponse(200, { ...ME, ...over }));
      await expect(newService().restoreSelection()).resolves.toBeNull();
    }
    stubFetch(() => jsonResponse(500, { code: 'X' }));
    await expect(newService().restoreSelection()).rejects.toMatchObject({
      kind: 'http',
      status: 500,
    });
  });

  it('localStorage 에 역할·동네를 따로 저장하지 않는다(토큰만 있다)', async () => {
    saveToken();
    stubFetch(() => jsonResponse(200, ME));
    await newService().restoreSelection();

    expect(Object.keys(localStorage)).toEqual(['yyt.session']);
    expect(localStorage.getItem('yyt.session')).not.toContain('보정동');
  });
});
