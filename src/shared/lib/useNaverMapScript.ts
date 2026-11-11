import { useEffect, useSyncExternalStore } from 'react';

/*
 * 네이버 지도(Web Dynamic Map, JavaScript API v3) 스크립트를 지도가 필요한 화면에서 한 번만 동적으로 불러온다.
 * 공식 문서: https://navermaps.github.io/maps.js.ncp/docs/tutorial-2-Getting-Started.html
 *   - 스크립트: https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId={Client ID}
 *     (이전 이름 ncpClientId 는 문서에서 "변경 전"으로 표시되어 ncpKeyId 를 쓴다.)
 *   - 인증 실패: 전역 함수 window.navermap_authFailure 가 정의돼 있으면 SDK 가 부른다.
 * 키(Client ID)는 브라우저에 공개되는 값이다. 로그·콘솔·오류 메시지에 출력하지 않는다.
 * 현재 위치 권한은 요청하지 않는다.
 */

/** 스크립트 주소. */
const SCRIPT_URL = 'https://oapi.map.naver.com/openapi/v3/maps.js';
/** 키 쿼리 파라미터 이름. 문서가 바뀌면 이 상수만 고친다(ncpKeyId ↔ ncpClientId). */
export const NAVER_MAP_KEY_PARAM = 'ncpKeyId';
/**
 * 함께 불러올 서브모듈. 주소 → 좌표 검색(naver.maps.Service.geocode)에 geocoder 가 필요하다(내 가게 위치 선택).
 * 클라이언트 지오코더는 Client ID 만 쓴다(Client Secret 은 쓰지 않는다).
 */
export const NAVER_MAP_SUBMODULES = 'geocoder';
/** 이미 삽입된 스크립트를 찾는 표식(HMR 등으로 모듈 상태가 초기화돼도 중복 삽입하지 않는다). */
const SCRIPT_MARK = 'data-naver-map-sdk';

export type NaverMapStatus = 'idle' | 'loading' | 'ready' | 'error';
/** error 일 때의 원인. no-key 는 개발 환경에서 키를 설정하지 않은 정상적인 경우다. */
export type NaverMapErrorReason = 'no-key' | 'load-failed' | 'auth-failed';

export interface NaverMapScriptState {
  status: NaverMapStatus;
  reason: NaverMapErrorReason | null;
}

const IDLE: NaverMapScriptState = { status: 'idle', reason: null };
const LOADING: NaverMapScriptState = { status: 'loading', reason: null };
const READY: NaverMapScriptState = { status: 'ready', reason: null };
const error = (reason: NaverMapErrorReason): NaverMapScriptState => ({ status: 'error', reason });

let state: NaverMapScriptState = IDLE;
const listeners = new Set<() => void>();

function setState(next: NaverMapScriptState) {
  state = next;
  listeners.forEach((listener) => listener());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const getSnapshot = () => state;

const readKey = () => import.meta.env.VITE_NAVER_MAP_CLIENT_ID?.trim() ?? '';
const sdkLoaded = () => typeof window.naver?.maps?.Map === 'function';

/*
 * window.navermap_authFailure 는 전역 하나뿐이라 다른 코드가 덮어쓰면 감지가 끊긴다.
 * 접근자로 바꿔 두고, 나중에 다른 코드가 대입한 함수는 따로 보관해 우리 처리와 함께 부른다.
 */
let authHookInstalled = false;
let foreignAuthHandler: (() => void) | undefined;

function installAuthFailureHook() {
  if (authHookInstalled) return;
  authHookInstalled = true;
  foreignAuthHandler = window.navermap_authFailure;
  Object.defineProperty(window, 'navermap_authFailure', {
    configurable: true,
    get: () => () => {
      setState(error('auth-failed'));
      foreignAuthHandler?.();
    },
    set: (handler: (() => void) | undefined) => {
      foreignAuthHandler = handler;
    },
  });
}

function attach(script: HTMLScriptElement) {
  script.addEventListener('load', () => setState(sdkLoaded() ? READY : error('load-failed')));
  script.addEventListener('error', () => {
    script.remove();
    setState(error('load-failed'));
  });
}

/**
 * 스크립트가 아직 없으면 한 번만 삽입한다. 여러 컴포넌트가 불러도, React StrictMode 에서 이펙트가 두 번 돌아도
 * 상태가 idle 일 때만 동작하므로 <script> 는 하나다. 키가 없으면 SDK 를 불러오지 않고 error(no-key)다.
 */
export function ensureNaverMapScript(): void {
  if (state.status !== 'idle') return;

  const key = readKey();
  if (!key) {
    setState(error('no-key'));
    return;
  }

  installAuthFailureHook();
  if (sdkLoaded()) {
    setState(READY);
    return;
  }

  setState(LOADING);
  const existing = document.querySelector<HTMLScriptElement>(`script[${SCRIPT_MARK}]`);
  if (existing) {
    attach(existing);
    return;
  }
  const script = document.createElement('script');
  script.async = true;
  script.setAttribute(SCRIPT_MARK, '');
  script.src = `${SCRIPT_URL}?${NAVER_MAP_KEY_PARAM}=${encodeURIComponent(key)}&submodules=${NAVER_MAP_SUBMODULES}`;
  attach(script);
  document.head.appendChild(script);
}

/** 테스트 전용: 모듈 상태, 삽입한 스크립트, 인증 실패 콜백을 처음 상태로 되돌린다. */
export function resetNaverMapScriptForTests(): void {
  document.querySelectorAll(`script[${SCRIPT_MARK}]`).forEach((node) => node.remove());
  if (authHookInstalled) {
    Reflect.deleteProperty(window, 'navermap_authFailure');
    authHookInstalled = false;
    foreignAuthHandler = undefined;
  }
  listeners.clear();
  state = IDLE;
}

/**
 * 네이버 지도 스크립트 상태(idle | loading | ready | error). 호출하면 한 번만 불러온다.
 * 키가 없거나, 로드에 실패하거나, 인증에 실패하면 error 이고 reason 으로 원인을 구분한다.
 */
export function useNaverMapScript(): NaverMapScriptState {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  useEffect(() => {
    ensureNaverMapScript();
  }, []);
  return snapshot;
}
