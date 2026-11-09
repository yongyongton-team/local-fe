import { isApiError, isKnownErrorCode, type KnownErrorCode } from './apiError';

/** 표에 없는 오류, 5xx, 문구가 정해지지 않은 코드에 쓰는 마지막 문구 */
export const FALLBACK_ERROR_MESSAGE = '일시적인 문제가 생겼어요. 잠시 후 다시 시도해 주세요.';

/** 서버에 닿지 못했을 때(오프라인, DNS, CORS 차단 등) */
const NETWORK_MESSAGE = '네트워크 연결을 확인하고 다시 시도해 주세요.';
/** 응답이 오지 않았을 때 */
const TIMEOUT_MESSAGE = '응답이 늦어지고 있어요. 잠시 후 다시 시도해 주세요.';

/**
 * 오류 코드별 화면 문구. 서버 message 는 쓰지 않고 이 표로만 정한다.
 * 문구는 그 코드를 쓰는 화면(단계)을 연동할 때 이 표에 추가한다. 표에 없는 코드는 마지막 문구로 대체된다.
 * 아직 문구가 없는 코드: ALREADY_REQUESTED, ALREADY_ORDERED, OFFER_CLOSED, AI_UNAVAILABLE.
 */
export const ERROR_MESSAGES_BY_CODE: Partial<Record<KnownErrorCode, string>> = {
  VALIDATION_ERROR: '선택한 정보를 확인하지 못했어요. 역할과 동네를 다시 선택해 주세요.',
  NOT_FOUND: '선택한 동네를 찾을 수 없어요. 다른 동네를 선택해 주세요.',
  // 자동 재로그인 후 재시도에도 실패한 경우(401 한 번은 클라이언트가 스스로 복구한다)
  UNAUTHORIZED: '로그인 상태를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.',
  // 다른 역할 전용 API(예: 역할이 없거나 사장님인 계정의 주민 조회)
  FORBIDDEN: '이 화면을 볼 수 있는 역할이 아니에요. 처음 화면에서 역할을 다시 선택해 주세요.',
};

/** 오류 본문에 code 가 없을 때(게이트웨이 HTML 등) 상태 코드로 대신 고르는 코드 */
const CODE_BY_STATUS: Readonly<Record<number, KnownErrorCode>> = {
  400: 'VALIDATION_ERROR',
  401: 'UNAUTHORIZED',
  404: 'NOT_FOUND',
};

/**
 * ApiError 를 화면에 보여줄 한국어 문구로 바꾼다. 서버가 보낸 message 는 보존하지도 쓰지도 않는다.
 * - network, timeout 은 종류로 구분한다.
 * - 5xx 는 코드와 무관하게 마지막 문구다.
 * - http 는 code(없으면 상태 코드)로 표에서 찾고, 표에 없으면 마지막 문구다.
 * - ApiError 가 아닌 오류와 parse 오류도 마지막 문구다.
 */
export function describeApiError(error: unknown): string {
  if (!isApiError(error)) return FALLBACK_ERROR_MESSAGE;
  if (error.kind === 'network') return NETWORK_MESSAGE;
  if (error.kind === 'timeout') return TIMEOUT_MESSAGE;
  if (error.kind !== 'http') return FALLBACK_ERROR_MESSAGE;
  if (error.status !== undefined && error.status >= 500) return FALLBACK_ERROR_MESSAGE;

  const code = isKnownErrorCode(error.code)
    ? error.code
    : error.code === undefined && error.status !== undefined
      ? CODE_BY_STATUS[error.status]
      : undefined;
  return (code && ERROR_MESSAGES_BY_CODE[code]) || FALLBACK_ERROR_MESSAGE;
}
