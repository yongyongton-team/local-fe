import { ApiError } from './apiError';

/**
 * 서버의 동·업종 id 는 양의 정수(int64)이고 도메인의 id 는 문자열(slug 였던 값)이다.
 * 서버 → 도메인: 안전한 양의 정수가 아니면 parse 오류.
 */
export function toDomainId(id: unknown): string {
  if (typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0) {
    throw new ApiError({
      kind: 'parse',
      code: 'INVALID_ID',
      message: '서버가 준 id 가 양의 정수가 아니에요.',
    });
  }
  return String(id);
}

/** 도메인 → 서버: 숫자로만 된 문자열(예: "28")만 숫자로 바꾼다. slug("guseong") 같은 값은 오류. */
export function toServerId(id: string): number {
  const value = /^[1-9]\d*$/.test(id) ? Number(id) : Number.NaN;
  if (!Number.isSafeInteger(value)) {
    throw new ApiError({
      kind: 'parse',
      code: 'INVALID_ID',
      message: '숫자가 아닌 id 는 서버로 보낼 수 없어요.',
    });
  }
  return value;
}
