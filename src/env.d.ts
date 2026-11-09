/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * 네이버 지도 Web Dynamic Map 의 Client ID(ncpKeyId 값). 브라우저에 공개되는 값이다.
   * Client Secret 은 프런트에서 쓰지 않으므로 어떤 환경 변수에도 넣지 않는다.
   */
  readonly VITE_NAVER_MAP_CLIENT_ID?: string;
  /** 백엔드 API 호스트(예: https://example.com). /api/v1 은 코드 상수라 붙이지 않는다. 브라우저에 공개되는 값이다. */
  readonly VITE_API_BASE_URL?: string;
  /** 서비스 구현 선택: mock | api. 비어 있거나 잘못된 값은 mock. 브라우저에 공개되는 값이다. */
  readonly VITE_DATA_SOURCE?: string;
}

interface Window {
  /** 네이버 지도 Open API 인증 실패 시 SDK 가 부르는 전역 콜백(공식 문서). 설치·연결은 useNaverMapScript 만 한다. */
  navermap_authFailure?: () => void;
}
