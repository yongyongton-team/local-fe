import { act, render, renderHook, screen } from '@testing-library/react';
import { StrictMode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { installFakeNaver } from '@/test/fakeNaverMaps';
import {
  NAVER_MAP_KEY_PARAM,
  useNaverMapScript,
  type NaverMapScriptState,
} from './useNaverMapScript';

const scripts = () => document.querySelectorAll<HTMLScriptElement>('script[data-naver-map-sdk]');

function Probe({ id }: { id: string }) {
  const { status, reason } = useNaverMapScript();
  return <p data-testid={id}>{`${status}:${reason ?? ''}`}</p>;
}

describe('useNaverMapScript', () => {
  it('키가 없으면 SDK 를 불러오지 않고 error(no-key)다', () => {
    const { result } = renderHook(() => useNaverMapScript());

    expect(result.current).toEqual<NaverMapScriptState>({ status: 'error', reason: 'no-key' });
    expect(scripts()).toHaveLength(0);
  });

  it('키가 공백뿐이어도 없는 것으로 본다', () => {
    vi.stubEnv('VITE_NAVER_MAP_CLIENT_ID', '   ');
    const { result } = renderHook(() => useNaverMapScript());

    expect(result.current.reason).toBe('no-key');
    expect(scripts()).toHaveLength(0);
  });

  it('여러 컴포넌트가 동시에 호출하고 StrictMode 에서 이펙트가 두 번 돌아도 <script> 는 하나다', () => {
    vi.stubEnv('VITE_NAVER_MAP_CLIENT_ID', 'test-key');
    render(
      <StrictMode>
        <Probe id="a" />
        <Probe id="b" />
        <Probe id="c" />
      </StrictMode>,
    );

    expect(scripts()).toHaveLength(1);
    expect(screen.getByTestId('a')).toHaveTextContent('loading:');
    expect(screen.getByTestId('c')).toHaveTextContent('loading:');
  });

  it('스크립트 주소는 공식 형식(ncpKeyId=키)이고 키 파라미터 이름은 상수 한 곳이다', () => {
    vi.stubEnv('VITE_NAVER_MAP_CLIENT_ID', 'test key/1');
    renderHook(() => useNaverMapScript());

    const url = new URL(scripts()[0]!.src);
    expect(NAVER_MAP_KEY_PARAM).toBe('ncpKeyId');
    expect(`${url.origin}${url.pathname}`).toBe('https://oapi.map.naver.com/openapi/v3/maps.js');
    expect(url.searchParams.get(NAVER_MAP_KEY_PARAM)).toBe('test key/1');
    // 주소 검색(내 가게 위치)에 쓰는 geocoder 서브모듈을 함께 불러온다. Client Secret 은 쓰지 않는다.
    expect(url.searchParams.get('submodules')).toBe('geocoder');
    expect(url.search).not.toMatch(/secret/i);
    expect(scripts()[0]!.async).toBe(true);
  });

  it('load 이벤트 뒤 window.naver.maps 가 있으면 ready 이고 모든 호출자에게 알린다', () => {
    vi.stubEnv('VITE_NAVER_MAP_CLIENT_ID', 'test-key');
    render(
      <>
        <Probe id="a" />
        <Probe id="b" />
      </>,
    );

    act(() => {
      installFakeNaver();
      scripts()[0]!.dispatchEvent(new Event('load'));
    });

    expect(screen.getByTestId('a')).toHaveTextContent('ready:');
    expect(screen.getByTestId('b')).toHaveTextContent('ready:');
    expect(scripts()).toHaveLength(1);
  });

  it('SDK 가 이미 로드돼 있으면 스크립트를 넣지 않고 바로 ready 다', () => {
    vi.stubEnv('VITE_NAVER_MAP_CLIENT_ID', 'test-key');
    installFakeNaver();
    const { result } = renderHook(() => useNaverMapScript());

    expect(result.current.status).toBe('ready');
    expect(scripts()).toHaveLength(0);
  });

  it('load 뒤에도 window.naver 가 없으면 error(load-failed)다', () => {
    vi.stubEnv('VITE_NAVER_MAP_CLIENT_ID', 'test-key');
    const { result } = renderHook(() => useNaverMapScript());

    act(() => {
      scripts()[0]!.dispatchEvent(new Event('load'));
    });

    expect(result.current).toEqual({ status: 'error', reason: 'load-failed' });
  });

  it('스크립트 로드 오류는 error(load-failed)이고 실패한 스크립트는 지운다', () => {
    vi.stubEnv('VITE_NAVER_MAP_CLIENT_ID', 'test-key');
    const { result } = renderHook(() => useNaverMapScript());

    act(() => {
      scripts()[0]!.dispatchEvent(new Event('error'));
    });

    expect(result.current).toEqual({ status: 'error', reason: 'load-failed' });
    expect(scripts()).toHaveLength(0);
  });

  it('인증 실패(window.navermap_authFailure)는 ready 가 된 뒤에도 error(auth-failed)로 바꾼다', () => {
    vi.stubEnv('VITE_NAVER_MAP_CLIENT_ID', 'test-key');
    const { result } = renderHook(() => useNaverMapScript());
    act(() => {
      installFakeNaver();
      scripts()[0]!.dispatchEvent(new Event('load'));
    });
    expect(result.current.status).toBe('ready');

    act(() => {
      window.navermap_authFailure?.();
    });

    expect(result.current).toEqual({ status: 'error', reason: 'auth-failed' });
  });

  it('다른 코드가 navermap_authFailure 를 덮어써도 우리 감지는 유지되고 그 함수도 함께 불린다', () => {
    vi.stubEnv('VITE_NAVER_MAP_CLIENT_ID', 'test-key');
    const foreign = vi.fn();
    const { result } = renderHook(() => useNaverMapScript());

    window.navermap_authFailure = foreign;
    act(() => {
      window.navermap_authFailure?.();
    });

    expect(result.current.reason).toBe('auth-failed');
    expect(foreign).toHaveBeenCalledTimes(1);
  });

  it('이미 있던 navermap_authFailure 도 보존해 함께 부른다', () => {
    vi.stubEnv('VITE_NAVER_MAP_CLIENT_ID', 'test-key');
    const existing = vi.fn();
    window.navermap_authFailure = existing;
    renderHook(() => useNaverMapScript());

    act(() => {
      window.navermap_authFailure?.();
    });

    expect(existing).toHaveBeenCalledTimes(1);
  });

  it('키 값을 콘솔에 출력하지 않는다', () => {
    vi.stubEnv('VITE_NAVER_MAP_CLIENT_ID', 'secret-looking-key');
    const spies = (['log', 'warn', 'error', 'info'] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => undefined),
    );
    const { result } = renderHook(() => useNaverMapScript());
    act(() => {
      scripts()[0]!.dispatchEvent(new Event('error'));
    });

    expect(result.current.status).toBe('error');
    spies.forEach((spy) => expect(JSON.stringify(spy.mock.calls)).not.toContain('secret-looking'));
    vi.restoreAllMocks();
  });
});
