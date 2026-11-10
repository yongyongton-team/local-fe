/**
 * API 오류의 종류.
 * - network: 서버에 닿지 못했다(오프라인, DNS, CORS 차단 등)
 * - timeout: 정해진 시간 안에 응답이 오지 않았다
 * - http: 서버가 오류 상태(4xx, 5xx)로 응답했다
 * - parse: 성공 응답인데 본문을 해석할 수 없다
 */
export type ApiErrorKind = 'network' | 'timeout' | 'http' | 'parse';

/** 서버가 오류 본문 {code, message} 에 쓰는 코드(백엔드 합의 표). */
export const KNOWN_ERROR_CODES = [
  'VALIDATION_ERROR', // 400 필수 값이 없거나 형식이 틀림
  'UNAUTHORIZED', // 401 토큰이 없거나 만료됨
  'FORBIDDEN', // 403 역할이 맞지 않거나 남의 것을 고치려 함
  'NOT_FOUND', // 404 없는 동·업종·제안
  'ALREADY_REQUESTED', // 409 같은 동·같은 업종을 이미 요청함
  'ALREADY_ORDERED', // 409 같은 제안에 이미 선주문함
  'OFFER_CLOSED', // 409 마감·취소된 제안에 주문하거나 고치려 함
  'AI_UNAVAILABLE', // 502 AI 호출 실패(요청 정리만)
] as const;

export type KnownErrorCode = (typeof KNOWN_ERROR_CODES)[number];

/**
 * 오류 코드. 알려진 코드의 유니온에 string 을 더해(자동완성은 유지) 서버가 모르는 코드를 보내도 깨지지 않는다.
 * 클라이언트가 만드는 코드(예: CONFIG_API_BASE_URL, INVALID_ID)도 여기에 포함된다.
 */
export type ApiErrorCode = KnownErrorCode | (string & {});

export function isKnownErrorCode(code: unknown): code is KnownErrorCode {
  return typeof code === 'string' && (KNOWN_ERROR_CODES as readonly string[]).includes(code);
}

interface ApiErrorInit {
  kind: ApiErrorKind;
  message: string;
  /** http 일 때의 HTTP 상태 코드 */
  status?: number;
  /** 서버 오류 본문의 code. 코드별 한국어 문구는 나중에 이 값으로 붙인다. */
  code?: ApiErrorCode;
}

/**
 * 정규화한 API 오류. message 는 개발자용 설명이고 화면에 그대로 보여주지 않는다.
 * 서버가 보낸 message 는 보존하지 않는다(화면 문구는 code 로 정한다).
 */
export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;
  readonly code?: ApiErrorCode;

  constructor({ kind, message, status, code }: ApiErrorInit) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    if (status !== undefined) this.status = status;
    if (code !== undefined) this.code = code;
  }
}

export const isApiError = (error: unknown): error is ApiError => error instanceof ApiError;
