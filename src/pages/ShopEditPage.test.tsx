import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { authService, DEMO_WRITE_BLOCKED_MESSAGE, demandService, meService } from '@/services';
import { ApiError } from '@/services/api/apiError';
import { DEFAULT_CENTER } from '@/shared/ui/naverMapDefaults';
import { installFakeNaver } from '@/test/fakeNaverMaps';
import { renderApp } from '@/test/renderApp';
import type { Me, StoreCategory } from '@/types/domain';

const merchantMe = (over: Partial<Me> = {}): Me => ({
  id: 7,
  nickname: '민트',
  role: 'merchant',
  dong: { id: 22, name: '구성동', district: '기흥구' },
  shop: null,
  ...over,
});
/** 등록된 가게. 목 업종 이름("과일·채소")과 같아서 id 가 없어도 이름으로 업종을 찾는다. */
const SAVED = {
  shopName: '싱싱과일',
  categoryName: '과일·채소',
  dongName: '구성동',
  lat: 37.2985,
  lng: 127.1085,
};

/** 키와 가짜 지도 SDK 를 준비하고 내 가게 화면을 연다(이전 화면이 /me 인 것처럼 열어 저장 뒤 /me 로 돌아가게 한다). */
async function openShop(me: Me, opts: { sdk?: boolean } = {}) {
  const naver = opts.sdk === false ? null : installFakeNaver();
  if (opts.sdk !== false) vi.stubEnv('VITE_NAVER_MAP_CLIENT_ID', 'test-key');
  vi.spyOn(meService, 'getMe').mockResolvedValue(me);
  const view = renderApp(['/me', '/me/shop'], undefined, 1);
  await screen.findByLabelText('가게 이름');
  return { naver, user: userEvent.setup(), ...view };
}

const nameInput = () => screen.getByRole('textbox', { name: '가게 이름' });
const categorySelect = () => screen.getByRole('combobox', { name: '업종' });
const addressInput = () => screen.getByRole('textbox', { name: '또는 주소로 찾기' });
const saveButton = () => screen.getByRole('button', { name: /^저장하기/ });
const fillBasics = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(nameInput(), '싱싱과일');
  await user.selectOptions(categorySelect(), '과일·채소');
};

afterEach(() => vi.restoreAllMocks());

describe('내 가게: 접근', () => {
  it.each(['resident', 'founder'] as const)('역할이 %s 이면 /me 로 돌려보낸다', async (role) => {
    vi.spyOn(meService, 'getMe').mockResolvedValue(merchantMe({ role }));
    const { router } = renderApp(['/me/shop']);

    await waitFor(() => expect(router.state.location.pathname).toBe('/me'));
    expect(screen.queryByLabelText('가게 이름')).not.toBeInTheDocument();
  });

  it('사장님이면 화면이 열린다: 로고, 뒤로 가기, 제목 "내 가게"', async () => {
    await openShop(merchantMe());

    expect(screen.getByRole('link', { name: '생기면 갈게요 메인으로 이동' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '뒤로 가기' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: '내 가게' })).toBeInTheDocument();
  });

  it('신규 등록과 수정이 같은 제목이다', async () => {
    await openShop(merchantMe({ shop: SAVED }));

    expect(screen.getByRole('heading', { level: 1, name: '내 가게' })).toBeInTheDocument();
  });

  it('하단 내비게이션도 우측 상단 내 정보 아이콘도 없다', async () => {
    await openShop(merchantMe());

    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '내 정보' })).not.toBeInTheDocument();
  });

  it('불러오는 동안 로딩 문구를 보여준다', () => {
    vi.spyOn(meService, 'getMe').mockReturnValue(new Promise<Me>(() => {}));
    renderApp(['/me/shop']);

    expect(screen.getByRole('status')).toHaveTextContent('불러오는 중이에요.');
  });

  it('내 정보를 가져오지 못하면 안내를 보여준다', async () => {
    vi.spyOn(meService, 'getMe').mockRejectedValue(new Error('x'));
    renderApp(['/me/shop']);

    expect(await screen.findByText('내 정보를 가져오지 못했어요')).toBeInTheDocument();
  });

  it('업종 목록을 가져오지 못하면 안내를 보여주고 폼은 없다', async () => {
    vi.spyOn(meService, 'getMe').mockResolvedValue(merchantMe());
    vi.spyOn(demandService, 'listCategories').mockRejectedValue(new Error('x'));
    renderApp(['/me/shop']);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '업종 목록을 불러오지 못했어요. 새로고침해 주세요.',
    );
    expect(screen.queryByLabelText('가게 이름')).not.toBeInTheDocument();
  });
});

describe('내 가게: 입력 구성', () => {
  it('라벨이 입력에 연결되어 있고, 업종 옵션은 업종 목록 데이터에서 온다(이름 하드코딩 없음)', async () => {
    const categories: StoreCategory[] = [
      {
        id: 'a',
        name: '꽃집',
        cardTitle: '꽃집',
        requestLabel: '꽃',
        missingLabel: '꽃',
        objectPhrase: '꽃집을',
        titleLabel: '꽃집',
      },
      {
        id: 'b',
        name: '문구점',
        cardTitle: '문구점',
        requestLabel: '문구',
        missingLabel: '문구',
        objectPhrase: '문구점을',
        titleLabel: '문구점',
      },
    ];
    vi.spyOn(demandService, 'listCategories').mockResolvedValue(categories);
    await openShop(merchantMe());

    expect(nameInput()).toBeInTheDocument();
    expect(addressInput()).toHaveAttribute('placeholder', '예 : 마북로 123');
    const names = within(categorySelect())
      .getAllByRole('option')
      .map((option) => option.textContent);
    expect(names).toEqual(['업종을 골라 주세요', '꽃집', '문구점']);
  });

  it('가게 위치 지도는 이름 있는 영역이고 핀은 장식이다', async () => {
    await openShop(merchantMe());

    const map = screen.getByRole('region', { name: /가게 위치 지도/ });
    const pin = map.querySelector('[aria-hidden="true"] svg');
    expect(pin).not.toBeNull();
  });

  it('디자인 주석("위치로 동네를 자동으로 찾아요 → …")은 화면에 없다', async () => {
    await openShop(merchantMe({ shop: SAVED }));

    expect(document.body).not.toHaveTextContent(/위치로 동네를 자동으로/);
    expect(document.body).not.toHaveTextContent(/자동으로 찾아요/);
    expect(document.body).not.toHaveTextContent('기흥구 마북동');
    // placeholder 는 주석이 아니라 실제 입력창 안내다.
    expect(addressInput()).toHaveAttribute('placeholder', '예 : 마북로 123');
  });
});

describe('내 가게: 수정 모드', () => {
  it('저장된 이름·업종·위치로 미리 채우고 지도는 그 좌표에서 시작하며 바로 저장할 수 있다', async () => {
    const { naver } = await openShop(merchantMe({ shop: SAVED }));

    expect(nameInput()).toHaveValue('싱싱과일');
    expect(categorySelect()).toHaveValue('fruit-vegetable');
    expect(naver!.maps).toHaveLength(1);
    expect(naver!.maps[0]!.options.center).toMatchObject({ lat: 37.2985, lng: 127.1085 });
    expect(naver!.maps[0]!.options.zoom).toBe(16);
    expect(saveButton()).toBeEnabled();
  });

  it('서버 가게의 업종 id(숫자)로도 업종을 찾는다', async () => {
    vi.spyOn(demandService, 'listCategories').mockResolvedValue([
      {
        id: '7',
        name: '과일·채소 가게',
        cardTitle: 'x',
        requestLabel: 'x',
        missingLabel: 'x',
        objectPhrase: 'x',
        titleLabel: 'x',
      },
      {
        id: '33',
        name: '태권도장',
        cardTitle: 'y',
        requestLabel: 'y',
        missingLabel: 'y',
        objectPhrase: 'y',
        titleLabel: 'y',
      },
    ]);
    await openShop(
      merchantMe({ shop: { ...SAVED, categoryId: 33, categoryName: '이름이 달라도' } }),
    );

    expect(categorySelect()).toHaveValue('33');
  });

  it('좌표가 없는 가게는 신규처럼 위치를 새로 정해야 한다', async () => {
    const { lat, lng, ...withoutPoint } = SAVED;
    void lat;
    void lng;
    await openShop(merchantMe({ shop: withoutPoint }));

    expect(nameInput()).toHaveValue('싱싱과일');
    expect(saveButton()).toBeDisabled();
  });
});

describe('내 가게: 신규 등록과 저장 버튼 활성 조건', () => {
  it('비어 있는 상태로 시작하고 지도는 기본 중심에서 시작하며 저장은 비활성이다', async () => {
    const { naver } = await openShop(merchantMe({ shop: null }));

    expect(nameInput()).toHaveValue('');
    expect(categorySelect()).toHaveValue('');
    expect(addressInput()).toHaveValue('');
    expect(naver!.maps[0]!.options.center).toMatchObject(DEFAULT_CENTER);
    expect(saveButton()).toBeDisabled();
  });

  it('이름·업종을 채워도 위치를 정하기 전에는(초기 중심을 그냥 저장하지 않는다) 비활성이다', async () => {
    const { user } = await openShop(merchantMe());

    await fillBasics(user);

    expect(saveButton()).toBeDisabled();
  });

  it('지도를 움직여 위치가 정해지면 활성이 된다', async () => {
    const { user, naver } = await openShop(merchantMe());
    await fillBasics(user);

    act(() => naver!.maps[0]!.drag(37.31, 127.12));

    expect(saveButton()).toBeEnabled();
  });

  it('위치만 정하고 이름이나 업종이 없으면 비활성이다(이름은 앞뒤 공백을 뺀 뒤 비어 있으면 없는 것)', async () => {
    const { user, naver } = await openShop(merchantMe());
    act(() => naver!.maps[0]!.drag(37.31, 127.12));
    expect(saveButton()).toBeDisabled();

    await user.type(nameInput(), '   ');
    await user.selectOptions(categorySelect(), '과일·채소');
    expect(saveButton()).toBeDisabled();

    await user.type(nameInput(), '싱싱과일');
    expect(saveButton()).toBeEnabled();

    await user.clear(nameInput());
    expect(saveButton()).toBeDisabled();
  });

  it('지도가 움직이지 않는 코드 이동(이미 정한 좌표와 같은 중심 이벤트)이 없으면 위치가 정해지지 않는다', async () => {
    const { user, naver } = await openShop(merchantMe());
    await fillBasics(user);

    // idle 만 나고 사용자가 움직이지 않은 경우(예: 크기 변경) — 위치는 그대로 미정이다.
    act(() => naver!.maps[0]!.emit('idle'));

    expect(saveButton()).toBeDisabled();
  });
});

describe('내 가게: 주소로 찾기', () => {
  it('엔터로 검색하면 결과 좌표로 지도 중심이 옮겨지고 위치가 정해진다', async () => {
    const { user, naver } = await openShop(merchantMe());
    naver!.setGeocode(() => ({ lat: 37.2999, lng: 127.1111 }));
    await fillBasics(user);

    await user.type(addressInput(), '마북로 123{Enter}');

    await waitFor(() => expect(naver!.maps[0]!.setCenter).toHaveBeenCalledTimes(1));
    expect(naver!.geocodeCalls).toEqual([{ query: '마북로 123' }]);
    expect(naver!.maps[0]!.setCenter).toHaveBeenCalledWith(
      expect.objectContaining({ lat: 37.2999, lng: 127.1111 }),
    );
    expect(naver!.maps[0]!.setZoom).toHaveBeenCalledWith(16);
    expect(saveButton()).toBeEnabled();
    expect(screen.queryByText('주소를 찾지 못했어요')).not.toBeInTheDocument();
  });

  it('입력을 멈추고 잠시 뒤에도 검색한다(입력하는 동안에는 한 번만)', async () => {
    const { user, naver } = await openShop(merchantMe());
    naver!.setGeocode(() => ({ lat: 37.2999, lng: 127.1111 }));

    await user.type(addressInput(), '마북로');

    await waitFor(() => expect(naver!.geocodeCalls).toHaveLength(1), { timeout: 3000 });
    expect(naver!.geocodeCalls[0]).toEqual({ query: '마북로' });
  });

  it('결과가 없으면 임시 문구 "주소를 찾지 못했어요"를 보여주고 위치는 정해지지 않는다', async () => {
    const { user, naver } = await openShop(merchantMe());
    naver!.setGeocode(() => null);
    await fillBasics(user);

    await user.type(addressInput(), '없는주소{Enter}');

    expect(await screen.findByText('주소를 찾지 못했어요')).toBeInTheDocument();
    expect(naver!.maps[0]!.setCenter).not.toHaveBeenCalled();
    expect(saveButton()).toBeDisabled();
  });

  it('검색 오류도 같은 문구이고, 다시 입력하면 문구가 사라진다', async () => {
    const { user, naver } = await openShop(merchantMe());
    naver!.setGeocode(() => 'error');

    await user.type(addressInput(), '아무거나{Enter}');
    expect(await screen.findByText('주소를 찾지 못했어요')).toBeInTheDocument();

    await user.type(addressInput(), '1');
    expect(screen.queryByText('주소를 찾지 못했어요')).not.toBeInTheDocument();
  });

  it('지오코더(주소 검색 서브모듈)를 쓸 수 없으면 같은 문구를 보여준다', async () => {
    const { user, naver } = await openShop(merchantMe());
    Reflect.deleteProperty(window.naver!.maps, 'Service');

    await user.type(addressInput(), '마북로 123{Enter}');

    expect(await screen.findByText('주소를 찾지 못했어요')).toBeInTheDocument();
    expect(naver!.geocodeCalls).toHaveLength(0);
  });

  it('빈 입력은 검색하지 않는다', async () => {
    const { user, naver } = await openShop(merchantMe());

    await user.type(addressInput(), '   {Enter}');

    expect(naver!.geocodeCalls).toHaveLength(0);
    expect(screen.queryByText('주소를 찾지 못했어요')).not.toBeInTheDocument();
  });

  it('주소 입력의 엔터는 폼 저장을 일으키지 않는다', async () => {
    const save = vi.spyOn(meService, 'saveShop');
    const { user, naver } = await openShop(merchantMe({ shop: SAVED }));
    naver!.setGeocode(() => ({ lat: 37.3, lng: 127.1 }));

    await user.type(addressInput(), '마북로{Enter}');

    expect(save).not.toHaveBeenCalled();
  });
});

describe('내 가게: 저장', () => {
  it('PUT 인자(이름은 공백을 뺀 값, 업종 id, 좌표)로 저장하고 내 정보로 돌아간다', async () => {
    const save = vi.spyOn(meService, 'saveShop').mockResolvedValue(undefined);
    const { user, naver, router } = await openShop(merchantMe());
    await user.type(nameInput(), '  싱싱과일  ');
    await user.selectOptions(categorySelect(), '과일·채소');
    act(() => naver!.maps[0]!.drag(37.31, 127.12));

    await user.click(saveButton());

    await waitFor(() => expect(router.state.location.pathname).toBe('/me'));
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith({
      shopName: '싱싱과일',
      categoryId: 'fruit-vegetable',
      lat: 37.31,
      lng: 127.12,
    });
  });

  it('수정 모드는 고친 이름과 기존 좌표로 저장한다', async () => {
    const save = vi.spyOn(meService, 'saveShop').mockResolvedValue(undefined);
    const { user, router } = await openShop(merchantMe({ shop: SAVED }));

    await user.clear(nameInput());
    await user.type(nameInput(), '새 가게');
    await user.click(saveButton());

    await waitFor(() => expect(router.state.location.pathname).toBe('/me'));
    expect(save).toHaveBeenCalledWith({
      shopName: '새 가게',
      categoryId: 'fruit-vegetable',
      lat: 37.2985,
      lng: 127.1085,
    });
  });

  it('저장하는 동안 다시 눌러도(화면이 다시 그려지기 전) 요청은 한 번만 나간다', async () => {
    const gate: { release: () => void } = { release: () => {} };
    const save = vi.spyOn(meService, 'saveShop').mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          gate.release = resolve;
        }),
    );
    const { user, router } = await openShop(merchantMe({ shop: SAVED }));
    const button = saveButton();

    await act(async () => {
      button.click();
      button.click();
    });
    await user.click(saveButton());

    expect(save).toHaveBeenCalledTimes(1);
    expect(saveButton()).toHaveAttribute('aria-busy', 'true');
    gate.release();
    await waitFor(() => expect(router.state.location.pathname).toBe('/me'));
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('실패하면 이동하지 않고 오류 종류별 문구만 보여준다(서버 message 는 쓰지 않는다)', async () => {
    vi.spyOn(meService, 'saveShop').mockRejectedValue(
      new ApiError({ kind: 'http', status: 500, code: 'X', message: '서버 원문 노출 금지' }),
    );
    const { user, router } = await openShop(merchantMe({ shop: SAVED }));

    await user.click(saveButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '일시적인 문제가 생겼어요. 잠시 후 다시 시도해 주세요.',
    );
    expect(screen.queryByText(/서버 원문/)).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/me/shop');
    // 입력은 그대로이고 다시 저장할 수 있다.
    expect(nameInput()).toHaveValue('싱싱과일');
    expect(saveButton()).toBeEnabled();
  });

  it('400 VALIDATION_ERROR 는 가게 저장 맥락의 문구이고 서버 message 는 보이지 않는다', async () => {
    vi.spyOn(meService, 'saveShop').mockRejectedValue(
      new ApiError({
        kind: 'http',
        status: 400,
        code: 'VALIDATION_ERROR',
        message: '서버 원문 노출 금지',
      }),
    );
    const { user } = await openShop(merchantMe({ shop: SAVED }));

    await user.click(saveButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '가게 정보를 다시 확인해 주세요. 가게 이름, 업종, 위치를 살펴봐 주세요.',
    );
    expect(screen.queryByText(/서버 원문/)).not.toBeInTheDocument();
    expect(screen.queryByText(/역할과 동네/)).not.toBeInTheDocument();
  });

  it('네트워크 오류는 연결 확인 문구를 보여준다', async () => {
    vi.spyOn(meService, 'saveShop').mockRejectedValue(
      new ApiError({ kind: 'network', message: 'x' }),
    );
    const { user } = await openShop(merchantMe({ shop: SAVED }));

    await user.click(saveButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '네트워크 연결을 확인하고 다시 시도해 주세요.',
    );
  });

  it('데모 세션에서는 서버에 보내지 않고 기존 데모 차단 문구를 보여준다', async () => {
    vi.spyOn(authService, 'isDemoSession').mockReturnValue(true);
    const save = vi.spyOn(meService, 'saveShop');
    const { user, router } = await openShop(merchantMe({ shop: SAVED }));

    await user.click(saveButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(DEMO_WRITE_BLOCKED_MESSAGE);
    expect(save).not.toHaveBeenCalled();
    expect(router.state.location.pathname).toBe('/me/shop');
  });
});

describe('내 가게: 지도를 쓸 수 없을 때', () => {
  it('지도 키가 없으면 "지도를 불러오지 못했어요"를 보여주고 저장은 비활성이다(수정 모드여도)', async () => {
    await openShop(merchantMe({ shop: SAVED }), { sdk: false });

    expect(screen.getByRole('alert')).toHaveTextContent('지도를 불러오지 못했어요');
    expect(saveButton()).toBeDisabled();
  });

  it('스크립트를 불러오는 동안에는 안내하고 저장은 비활성이다', async () => {
    vi.stubEnv('VITE_NAVER_MAP_CLIENT_ID', 'test-key');
    vi.spyOn(meService, 'getMe').mockResolvedValue(merchantMe({ shop: SAVED }));
    renderApp(['/me/shop']);
    await screen.findByLabelText('가게 이름');

    expect(screen.getByRole('status')).toHaveTextContent('지도를 불러오는 중이에요.');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
  });

  it('스크립트 로드에 실패하면 같은 문구와 비활성이다', async () => {
    vi.stubEnv('VITE_NAVER_MAP_CLIENT_ID', 'test-key');
    vi.spyOn(meService, 'getMe').mockResolvedValue(merchantMe({ shop: SAVED }));
    renderApp(['/me/shop']);
    await screen.findByLabelText('가게 이름');

    act(() => {
      document.querySelector('script[data-naver-map-sdk]')!.dispatchEvent(new Event('error'));
    });

    expect(screen.getByRole('alert')).toHaveTextContent('지도를 불러오지 못했어요');
    expect(saveButton()).toBeDisabled();
  });

  it('인증 실패(navermap_authFailure)에서도 같다', async () => {
    const { naver } = await openShop(merchantMe({ shop: SAVED }));
    expect(naver!.maps).toHaveLength(1);

    act(() => window.navermap_authFailure?.());

    expect(screen.getByRole('alert')).toHaveTextContent('지도를 불러오지 못했어요');
    expect(saveButton()).toBeDisabled();
  });
});

describe('내 가게: 내 정보에서 들어와 저장하고 돌아오는 흐름(mock 서비스)', () => {
  it('"등록하기"로 들어가 저장하면 내 정보의 "내 가게" 값이 바뀐다', async () => {
    vi.stubEnv('VITE_NAVER_MAP_CLIENT_ID', 'test-key');
    const naver = installFakeNaver();
    const user = userEvent.setup();
    const { router } = renderApp(['/']);

    // 사장님으로 시작해 내 정보로 간다.
    await screen.findByRole('option', { name: '기흥구 구성동' });
    await user.click(screen.getByRole('radio', { name: /^사장님/ }));
    await user.click(screen.getByRole('button', { name: '시작하기' }));
    await screen.findByRole('heading', { level: 1, name: '내 업종을 원하는 동네' });
    await user.click(screen.getByRole('link', { name: '내 정보' }));
    await screen.findByText(/^ID : /);

    const row = screen.getByRole('link', { name: /내 가게/ });
    expect(row).toHaveTextContent('등록하기');
    await user.click(row);
    await screen.findByLabelText('가게 이름');

    await fillBasics(user);
    // 사장님 탐색 화면의 지도는 이미 정리됐다. 가장 마지막에 만든 지도가 위치 선택 지도다.
    act(() => naver.maps.at(-1)!.drag(37.31, 127.12));
    await user.click(saveButton());

    await waitFor(() => expect(router.state.location.pathname).toBe('/me'));
    expect(await screen.findByRole('link', { name: /내 가게/ })).toHaveTextContent(
      '싱싱과일 · 과일·채소',
    );
  });
});
