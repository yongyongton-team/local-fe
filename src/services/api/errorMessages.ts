import { isApiError, isKnownErrorCode, type KnownErrorCode } from './apiError';

/** 표에 없는 오류, 5xx, 문구가 정해지지 않은 코드에 쓰는 마지막 문구 */
export const FALLBACK_ERROR_MESSAGE = '일시적인 문제가 생겼어요. 잠시 후 다시 시도해 주세요.';

/**
 * 데모 세션에서 서버에 쓰는 호출을 막았을 때의 문구. [임시]
 * 데모 계정은 모두가 공유하는 계정이라 역할·동네를 바꾸지 못한다(사장님 화면만 볼 수 있다).
 */
export const DEMO_WRITE_BLOCKED_MESSAGE =
  '데모 계정은 사장님 화면만 볼 수 있어요. 나가려면 주소 끝에 ?demo=off를 붙여 주세요.';

/** 서버에 닿지 못했을 때(오프라인, DNS, CORS 차단 등) */
const NETWORK_MESSAGE = '네트워크 연결을 확인하고 다시 시도해 주세요.';
/** 응답이 오지 않았을 때 */
const TIMEOUT_MESSAGE = '응답이 늦어지고 있어요. 잠시 후 다시 시도해 주세요.';

/**
 * 오류 코드별 화면 문구. 서버 message 는 쓰지 않고 이 표로만 정한다.
 * 문구는 그 코드를 쓰는 화면(단계)을 연동할 때 이 표에 추가한다. 표에 없는 코드는 마지막 문구로 대체된다.
 * ALREADY_ORDERED·OFFER_CLOSED 는 선주문 화면의 order 맥락에서만 문구가 있다(ORDER_MESSAGES_BY_CODE).
 */
export const ERROR_MESSAGES_BY_CODE: Partial<Record<KnownErrorCode, string>> = {
  VALIDATION_ERROR: '선택한 정보를 확인하지 못했어요. 역할과 동네를 다시 선택해 주세요.',
  NOT_FOUND: '선택한 동네를 찾을 수 없어요. 다른 동네를 선택해 주세요.',
  // 자동 재로그인 후 재시도에도 실패한 경우(401 한 번은 클라이언트가 스스로 복구한다)
  UNAUTHORIZED: '로그인 상태를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.',
  // 다른 역할 전용 API(예: 역할이 없거나 사장님인 계정의 주민 조회)
  FORBIDDEN: '이 화면을 볼 수 있는 역할이 아니에요. 처음 화면에서 역할을 다시 선택해 주세요.',
  // 같은 동네·같은 업종을 이미 요청한 경우(요청 생성)
  ALREADY_REQUESTED: '이 동네에 같은 업종을 이미 요청했어요. 내 요청에서 확인해 보세요.',
  // AI 호출 실패(요청 정리). 화면은 업종 칩으로 직접 고르게 한다.
  AI_UNAVAILABLE: '요청 내용을 정리하지 못했어요. 업종을 직접 골라 주세요.',
};

/**
 * VALIDATION_ERROR(400)·NOT_FOUND(404)가 사용자에게 보이는 화면의 맥락. 같은 코드라도 무엇을 보낸 요청인지에 따라 확인할 항목이
 * 달라서 호출하는 화면이 describeApiError(error, context) 로 맥락을 알려 준다. 맥락을 주지 않으면(내 정보 저장·동네 선택 등)
 * ERROR_MESSAGES_BY_CODE 의 기존 문구를 쓴다. 서버가 400·404 의 정확한 원인을 구분해 주지 않으므로 맥락 문구도 단정하지 않는다.
 * - offer: 방문 판매 제안 보내기(POST /offers)
 * - request: 요청 작성·간편 요청(POST /requests)
 * - shop: 내 가게 저장(PUT /me/shop)
 * - parse: 요청 문장 정리(POST /requests/parse)
 * - order: 주민의 선주문·예약 취소(POST /offers/{id}/orders, DELETE /orders/{id})
 */
export type ErrorContext = 'offer' | 'request' | 'shop' | 'parse' | 'order';

/**
 * 맥락별 VALIDATION_ERROR 문구.
 * 제안(offer)의 400 은 서버 규칙상 날짜 순서(지금 < 마감 < 받는 시각), 내 가게 업종이 아닌 제안, 가게 미등록 등일 수 있어
 * 프론트가 원인을 구분하지 못한다. 그래서 값·날짜 순서·가게 정보를 함께 안내한다.
 */
// TODO(문구 확정 후 교체): 아래 네 문구는 임시다.
export const VALIDATION_MESSAGES_BY_CONTEXT: Readonly<Record<ErrorContext, string>> = {
  offer: '입력한 값을 확인해 주세요. 날짜 순서와 가게 정보도 확인해 주세요.',
  request: '요청 내용을 다시 확인해 주세요. 시간대와 이용 빈도를 선택했는지 살펴봐 주세요.',
  shop: '가게 정보를 다시 확인해 주세요. 가게 이름, 업종, 위치를 살펴봐 주세요.',
  parse: '요청 문장을 다시 확인해 주세요.',
  // 수량은 화면이 1~10 으로 막으므로 이 코드는 주로 내 동네가 아닌 제안에 주문한 경우다.
  order: '내 동네 제안에만 주문할 수 있어요.',
};

/**
 * 맥락별 NOT_FOUND 문구. 서버가 404 로 가리키는 대상(동네·업종 등)을 프론트가 구분할 수 없어 "동네나 업종"처럼 단정하지 않는다.
 */
// TODO(문구 확정 후 교체): 아래 네 문구는 임시다.
export const NOT_FOUND_MESSAGES_BY_CONTEXT: Readonly<Record<ErrorContext, string>> = {
  offer: '제안할 동네나 업종을 찾을 수 없어요. 다시 선택해 주세요.',
  request: '요청할 동네나 업종을 찾을 수 없어요. 다시 선택해 주세요.',
  shop: '선택한 업종이나 동네를 찾을 수 없어요. 다시 선택해 주세요.',
  parse: '요청을 정리할 동네를 찾을 수 없어요. 다시 선택해 주세요.',
  order: '취소되었거나 사라진 제안이에요.',
};

/**
 * order 맥락에서만 문구가 있는 코드. 선주문·예약 취소 화면은 이 문구를 보이고 서버 상태를 다시 불러온다.
 * 이 표는 context 가 order 일 때만 쓴다(다른 화면이 같은 코드를 받으면 기존 마지막 문구다).
 */
// TODO(문구 확정 후 교체): 아래 세 문구는 임시다.
export const ORDER_MESSAGES_BY_CODE: Readonly<Record<string, string>> = {
  ALREADY_ORDERED: '이미 선주문한 제안이에요.',
  OFFER_CLOSED: '주문이 마감됐거나 취소된 제안이에요.',
  FORBIDDEN: '내 예약이 아니라서 처리할 수 없어요.',
};

/** 5xx 이어도 코드별 문구를 보여주는 코드. AI_UNAVAILABLE 은 502 로 오지만 화면이 업종 직접 선택으로 이어가야 한다. */
const CODES_SHOWN_ON_5XX: readonly string[] = ['AI_UNAVAILABLE'];

/** 오류 본문에 code 가 없을 때(게이트웨이 HTML 등) 상태 코드로 대신 고르는 코드 */
const CODE_BY_STATUS: Readonly<Record<number, KnownErrorCode>> = {
  400: 'VALIDATION_ERROR',
  401: 'UNAUTHORIZED',
  404: 'NOT_FOUND',
};

/**
 * ApiError 를 화면에 보여줄 한국어 문구로 바꾼다. 서버가 보낸 message 는 보존하지도 쓰지도 않는다.
 * - network, timeout 은 종류로 구분한다.
 * - 5xx 는 마지막 문구다(AI_UNAVAILABLE 만 예외로 코드별 문구).
 * - http 는 code(없으면 상태 코드)로 표에서 찾고, 표에 없으면 마지막 문구다.
 * - context 가 있으면 VALIDATION_ERROR·NOT_FOUND 만 그 맥락의 문구로 바꾼다(다른 코드의 문구는 그대로다).
 *   order 맥락은 ALREADY_ORDERED·OFFER_CLOSED·FORBIDDEN 도 바꾼다.
 * - ApiError 가 아닌 오류와 parse 오류도 마지막 문구다.
 */
export function describeApiError(error: unknown, context?: ErrorContext): string {
  if (!isApiError(error)) return FALLBACK_ERROR_MESSAGE;
  if (error.code === 'DEMO_SESSION') return DEMO_WRITE_BLOCKED_MESSAGE;
  if (error.kind === 'network') return NETWORK_MESSAGE;
  if (error.kind === 'timeout') return TIMEOUT_MESSAGE;
  if (error.kind !== 'http') return FALLBACK_ERROR_MESSAGE;
  if (
    error.status !== undefined &&
    error.status >= 500 &&
    !(error.code !== undefined && CODES_SHOWN_ON_5XX.includes(error.code))
  ) {
    return FALLBACK_ERROR_MESSAGE;
  }

  const code = isKnownErrorCode(error.code)
    ? error.code
    : error.code === undefined && error.status !== undefined
      ? CODE_BY_STATUS[error.status]
      : undefined;
  if (context === 'order' && code !== undefined && ORDER_MESSAGES_BY_CODE[code] !== undefined) {
    return ORDER_MESSAGES_BY_CODE[code];
  }
  if (context !== undefined) {
    if (code === 'VALIDATION_ERROR') return VALIDATION_MESSAGES_BY_CONTEXT[context];
    if (code === 'NOT_FOUND') return NOT_FOUND_MESSAGES_BY_CONTEXT[context];
  }
  return (code && ERROR_MESSAGES_BY_CODE[code]) || FALLBACK_ERROR_MESSAGE;
}
