/**
 * API 오류의 종류.
 * - network: 서버에 닿지 못했다(오프라인, DNS, CORS 차단 등)
 * - timeout: 정해진 시간 안에 응답이 오지 않았다
 * - http: 서버가 오류 상태(4xx, 5xx)로 응답했다
 * - parse: 성공 응답인데 본문을 해석할 수 없다
 */
export type ApiErrorKind = 'network' | 'timeout' | 'http' | 'parse';

interface ApiErrorInit {
  kind: ApiErrorKind;
  message: string;
  /** http 일 때의 HTTP 상태 코드 */
  status?: number;
  /** 서버 오류 본문의 code. 코드별 한국어 문구는 나중에 이 값으로 붙인다. */
  code?: string;
}

/**
 * 정규화한 API 오류. message 는 개발자용 설명이고 화면에 그대로 보여주지 않는다.
 * 서버가 보낸 message 는 보존하지 않는다(화면 문구는 code 로 정한다).
 */
export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;
  readonly code?: string;

  constructor({ kind, message, status, code }: ApiErrorInit) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    if (status !== undefined) this.status = status;
    if (code !== undefined) this.code = code;
  }
}

export const isApiError = (error: unknown): error is ApiError => error instanceof ApiError;
