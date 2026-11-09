import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeJwt, jsonResponse, stubFetch } from '@/test/apiStub';

/** 서비스 진입점은 import 시점에 구현을 고르므로, 환경 값을 바꾼 뒤 모듈을 새로 불러온다. */
async function loadServices(env: { source?: string; base?: string } = {}) {
  vi.stubEnv('VITE_DATA_SOURCE', env.source ?? '');
  vi.stubEnv('VITE_API_BASE_URL', env.base ?? '');
  vi.resetModules();
  return {
    services: await import('./index'),
    mocks: {
      auth: (await import('./mockAuthService')).mockAuthService,
      me: (await import('./mockMeService')).mockMeService,
      demand: (await import('./mockDemandService')).mockDemandService,
      merchant: (await import('./mockMerchantService')).mockMerchantService,
      founder: (await import('./mockFounderService')).mockFounderService,
      myRequest: (await import('./mockMyRequestService')).mockMyRequestService,
      submitter: (await import('./mockRequestSubmitter')).mockRequestSubmitter,
      summarizer: (await import('./mockRequestSummarizer')).mockRequestSummarizer,
    },
  };
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => vi.restoreAllMocks());

describe('mock 모드(기본)', () => {
  it('환경 값이 비어 있으면(기본) 목 구현이고 아무 서비스를 불러도 fetch 가 호출되지 않는다', async () => {
    const { fn } = stubFetch(() => jsonResponse(200, {}));
    const { services, mocks } = await loadServices();

    expect(services.authService).toBe(mocks.auth);
    expect(services.meService).toBe(mocks.me);
    await services.authService.ensureSession();
    services.authService.clearSession();
    await expect(services.meService.getMe()).resolves.toMatchObject({ id: 0, shop: null });
    await expect(services.meService.checkHealth()).resolves.toEqual({
      details: { status: 'mock' },
    });
    await services.demandService.listNeighborhoods();
    await services.merchantService.listAreaDemands({ categoryId: 'fruit-vegetable', radiusKm: 3 });
    await services.founderService.listLocationRanks('fruit-vegetable');
    await services.myRequestService.listMyRequests();
    await services.requestSummarizer.summarize('과일가게');

    expect(fn).not.toHaveBeenCalled();
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it('VITE_DATA_SOURCE=mock 이어도 API 주소가 있어도 fetch 와 로그인은 일어나지 않는다', async () => {
    const { fn } = stubFetch(() => jsonResponse(200, {}));
    const { services } = await loadServices({ source: 'mock', base: 'https://api.test' });

    await services.authService.ensureSession();
    await services.meService.getMe();
    await services.meService.checkHealth();

    expect(fn).not.toHaveBeenCalled();
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it('잘못된 값은 mock 으로 처리하고 개발 환경에서만 경고한다(값만 알리고 다른 정보는 없다)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { fn } = stubFetch(() => jsonResponse(200, {}));
    const { services, mocks } = await loadServices({ source: 'API', base: 'https://api.test' });

    expect(services.authService).toBe(mocks.auth);
    await services.meService.getMe();
    expect(fn).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain('VITE_DATA_SOURCE');
    expect(String(warn.mock.calls[0]?.[0])).not.toContain('api.test');
  });

  it('값이 비어 있거나 mock 이면 경고하지 않는다', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await loadServices({ source: '' });
    await loadServices({ source: 'mock' });

    expect(warn).not.toHaveBeenCalled();
  });

  it('테스트 환경은 개발자의 .env.local 값과 무관하게 mock 이다(vitest 설정이 고정한다)', async () => {
    vi.unstubAllEnvs();
    vi.resetModules();
    const services = await import('./index');
    const mockAuth = (await import('./mockAuthService')).mockAuthService;

    expect(import.meta.env.VITE_DATA_SOURCE).toBe('mock');
    expect(services.authService).toBe(mockAuth);
  });
});

describe('api 모드', () => {
  it('인증·me·동네/업종 목록·주민 조회·요청 작성·내 요청·창업자만 API 구현이고, 나머지 서비스와 메서드는 모드와 무관하게 목이다', async () => {
    const { services, mocks } = await loadServices({ source: 'api', base: 'https://api.test' });

    expect(services.authService).not.toBe(mocks.auth);
    expect(services.meService).not.toBe(mocks.me);
    // 수요 서비스는 동네·업종 목록만 API 이고 나머지 메서드는 목 구현을 그대로 가리킨다.
    expect(services.demandService).not.toBe(mocks.demand);
    expect(services.demandService.listNeighborhoods).not.toBe(mocks.demand.listNeighborhoods);
    expect(services.demandService.listCategories).not.toBe(mocks.demand.listCategories);
    // 주민 조회(동네별 리포트·지도 마커)와 기본 업종도 API 이다(3단계).
    expect(services.demandService.listReportsByNeighborhood).not.toBe(
      mocks.demand.listReportsByNeighborhood,
    );
    expect(services.demandService.listMapMarkers).not.toBe(mocks.demand.listMapMarkers);
    expect(services.demandService.getDefaultCategoryId).not.toBe(mocks.demand.getDefaultCategoryId);
    expect(services.demandService.listReports).toBe(mocks.demand.listReports);
    expect(services.demandService.getReport).toBe(mocks.demand.getReport);
    expect(services.merchantService).toBe(mocks.merchant);
    // 예비 창업자 순위·리포트는 API 구현이다(5단계).
    expect(services.founderService).not.toBe(mocks.founder);
    expect([services.founderService.remote, mocks.founder.remote]).toEqual([true, false]);
    // 요청 작성(정리·제출)과 내 요청은 API 구현이다(4단계). 목과 달리 remote 이다.
    expect(services.myRequestService).not.toBe(mocks.myRequest);
    expect(services.requestSubmitter).not.toBe(mocks.submitter);
    expect(services.requestSummarizer).not.toBe(mocks.summarizer);
    expect([
      services.myRequestService.remote,
      services.requestSubmitter.remote,
      services.requestSummarizer.remote,
    ]).toEqual([true, true, true]);
    expect([mocks.myRequest.remote, mocks.submitter.remote, mocks.summarizer.remote]).toEqual([
      false,
      false,
      false,
    ]);
  });

  it('import 만으로는 fetch 도 로그인도 일어나지 않고, 처음 쓸 때 게스트 로그인한다', async () => {
    const { calls, fn } = stubFetch((call) =>
      call.path === '/api/v1/auth/guest'
        ? jsonResponse(200, { accessToken: fakeJwt({ exp: 9_999_999_999 }), expiresIn: 3600 })
        : jsonResponse(200, {}),
    );
    const { services } = await loadServices({ source: 'api', base: 'https://api.test' });
    expect(fn).not.toHaveBeenCalled();

    await services.authService.ensureSession();
    await services.authService.ensureSession();

    expect(calls.map((c) => [c.method, c.path])).toEqual([['POST', '/api/v1/auth/guest']]);
  });

  it('getMe 는 필요하면 로그인한 뒤 GET /me 를 보내고 도메인 값으로 바꾼다', async () => {
    const { calls } = stubFetch((call) =>
      call.path === '/api/v1/auth/guest'
        ? jsonResponse(200, { accessToken: 'tok-a', expiresIn: 3600 })
        : jsonResponse(200, { id: 3, nickname: '게스트', role: 'RESIDENT' }),
    );
    const { services } = await loadServices({ source: 'api', base: 'https://api.test' });

    await expect(services.meService.getMe()).resolves.toEqual({
      id: 3,
      nickname: '게스트',
      role: 'resident',
      dong: null,
      shop: null,
    });

    expect(calls.map((c) => [c.path, c.authorization])).toEqual([
      ['/api/v1/auth/guest', null],
      ['/api/v1/me', 'Bearer tok-a'],
    ]);
  });

  it('checkHealth 는 토큰 없이 GET /health 만 보낸다(로그인 없음)', async () => {
    const { calls } = stubFetch(() => jsonResponse(200, { status: 'UP' }));
    const { services } = await loadServices({ source: 'api', base: 'https://api.test' });

    await expect(services.meService.checkHealth()).resolves.toEqual({ details: { status: 'UP' } });

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ path: '/api/v1/health', authorization: null });
  });

  it('API 주소가 없으면 fetch 없이 CONFIG_API_BASE_URL ApiError 다', async () => {
    const { fn } = stubFetch(() => jsonResponse(200, {}));
    const { services } = await loadServices({ source: 'api', base: '' });

    await expect(services.meService.getMe()).rejects.toMatchObject({
      kind: 'network',
      code: 'CONFIG_API_BASE_URL',
    });
    expect(fn).not.toHaveBeenCalled();
  });

  it('clearSession 은 저장된 토큰을 지워 다음 요청에서 다시 로그인한다', async () => {
    const { calls } = stubFetch((call) =>
      call.path === '/api/v1/auth/guest'
        ? jsonResponse(200, { accessToken: 'tok-a', expiresIn: 3600 })
        : jsonResponse(200, { id: 1 }),
    );
    const { services } = await loadServices({ source: 'api', base: 'https://api.test' });
    await services.meService.getMe();

    services.authService.clearSession();
    await services.meService.getMe();

    expect(calls.filter((c) => c.path === '/api/v1/auth/guest')).toHaveLength(2);
  });
});
