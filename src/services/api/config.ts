import { ApiError } from './apiError';

/** 모든 API 경로의 공통 접두사. 호스트는 선택 환경 변수(VITE_API_BASE_URL, 없으면 상대 경로)이고 이 접두사는 코드 상수다. */
export const API_BASE_PATH = '/api/v1';

/** 서비스가 목(mock) 구현을 쓸지 실제 API 구현을 쓸지. */
export type DataSource = 'mock' | 'api';

/**
 * VITE_DATA_SOURCE 를 해석한다. "mock" 또는 "api" 만 유효하고, 비어 있거나 잘못된 값은 mock 이다.
 * 잘못된 값(비어 있지 않은데 둘 다 아님)일 때만 onInvalid 를 부른다(호출하는 쪽이 개발 환경에서만 넘긴다).
 */
export function resolveDataSource(
  raw: string | undefined,
  onInvalid?: (value: string) => void,
): DataSource {
  const value = raw?.trim() ?? '';
  if (value === 'api') return 'api';
  if (value === 'mock' || value === '') return 'mock';
  onInvalid?.(value);
  return 'mock';
}

/**
 * API 호스트(VITE_API_BASE_URL)를 읽는다. 선택 사항이다.
 * - 없거나 빈 값이면 빈 문자열을 돌려준다. 그러면 요청 주소가 상대 경로 `/api/v1/...` 가 되고, 개발·미리보기는
 *   Vite proxy(vite.config.ts)가, 배포는 같은 출처의 `/api` 전달이 서버로 넘긴다(CORS·서버 주소 설정이 필요 없다).
 * - 값이 있으면 호스트만 받는다(끝의 "/" 는 지운다. /api/v1 은 붙이지 않는다). 로컬 백엔드 등 다른 주소로 바꿔 쓸 때 쓴다.
 *   http(s) 호스트 주소가 아니면 ApiError(code CONFIG_API_BASE_URL)를 던진다.
 */
export function readApiBaseUrl(
  raw: string | undefined = import.meta.env.VITE_API_BASE_URL,
): string {
  const value = raw?.trim().replace(/\/+$/, '') ?? '';
  if (value === '') return '';
  if (!/^https?:\/\/[^/\s]+$/i.test(value)) {
    throw new ApiError({
      kind: 'network',
      code: 'CONFIG_API_BASE_URL',
      message: 'VITE_API_BASE_URL 은 비우거나 http(s) 호스트 주소여야 해요.',
    });
  }
  return value;
}

/**
 * 시연용 데모 진입을 켤지. API 모드이고 VITE_ENABLE_DEMO_LOGIN 이 정확히 "true" 일 때만 true 다(기본 꺼짐).
 * 꺼져 있으면 화면은 demo 쿼리 파라미터를 완전히 무시한다.
 */
export function isDemoLoginEnabled(dataSource: DataSource, raw: string | undefined): boolean {
  return dataSource === 'api' && raw?.trim() === 'true';
}
