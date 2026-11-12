import { describeApiError, isApiError, type ErrorContext } from '@/services';

/** 목 모드(ApiError 가 아닌 오류)의 기존 안내 문구 */
export const GENERIC_RETRY_TEXT = '잠시 후 다시 시도해 주세요.';

/**
 * 불러오기 실패 안내 문구. API 오류는 코드·종류별 문구(404 는 "선택한 동네를 찾을 수 없어요" 등)이고,
 * 그 밖의 오류(목 모드 포함)는 기존 문구 그대로다. context 는 VALIDATION_ERROR 문구만 바꾼다. 서버가 보낸 message 는 쓰지 않는다.
 */
export function describeLoadError(error: unknown, context?: ErrorContext): string {
  return isApiError(error) ? describeApiError(error, context) : GENERIC_RETRY_TEXT;
}
