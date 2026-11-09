/*
 * GET /dongs/{dongId}/gaps 의 status 로 "동네에 없는 가게" 카드로 보여줄 항목을 가린다.
 *
 * status 의 값과 뜻은 명세에 없고, 실제 서버 확인에서도 gaps 가 빈 배열이라 값을 하나도 보지 못했다(미확인).
 * 그래서 뜻이 확인된 값만 이 목록에 넣고, 목록이 비어 있는 동안에는 모든 gaps 항목을 보여준다(추측으로 거르지 않는다).
 * 값이 확인되면 이 상수만 채우면 된다. 판단 규칙은 이 파일의 isNoStoreGap 하나다.
 */
export const NO_STORE_STATUS_VALUES: readonly string[] = [];

/** 이 gaps 항목을 "동네에 없는 가게"로 보여줄지. confirmed 가 비어 있으면(뜻 미확인) 전부 보여준다. */
export function isNoStoreGap(
  status: unknown,
  confirmed: readonly string[] = NO_STORE_STATUS_VALUES,
): boolean {
  if (confirmed.length === 0) return true;
  return typeof status === 'string' && confirmed.includes(status);
}
