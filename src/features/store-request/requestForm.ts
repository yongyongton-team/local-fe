import { REQUEST_CATEGORY_CHOICES } from './constants';

/** 공백뿐인 입력은 비어 있는 것으로 본다. */
export function isBlank(text: string): boolean {
  return text.trim().length === 0;
}

export function getCategoryLabel(
  categoryId: string | null,
  choices: readonly { value: string; label: string }[] = REQUEST_CATEGORY_CHOICES,
): string | null {
  return choices.find((choice) => choice.value === categoryId)?.label ?? null;
}

interface SubmitState {
  text: string;
  categoryId: string | null;
  /** 정리 결과가 현재 입력 문장에 대한 것인지(입력 직후의 오래된 결과가 아닌지) */
  summaryIsCurrent: boolean;
  /** 같은 동네·업종을 이미 요청해서 막힌 상태인지(isDuplicateRequest) */
  duplicate?: boolean;
}

/**
 * 요청 보내기 활성 조건: 문장이 비어 있지 않고, 업종이 정해졌고, 정리 결과가 최신이고, 이미 요청한 업종이 아닐 때.
 * 시간대·빈도는 버튼을 막는 조건이 아니다. 비어 있으면 보내는 순간 안내를 보여준다(isVisitInfoMissing).
 */
export function canSubmitRequest({
  text,
  categoryId,
  summaryIsCurrent,
  duplicate = false,
}: SubmitState): boolean {
  return !isBlank(text) && categoryId !== null && summaryIsCurrent && !duplicate;
}

/**
 * 서버가 "이미 요청했다"(alreadyRequested)고 알려 준 업종을 지금도 선택하고 있는지.
 * 판단 근거는 parse 가 정한 업종(summary.categoryId)에 대한 것뿐이라, 선택한 업종이 그것과 다르면 막지 않는다.
 */
export function isDuplicateRequest(
  summary: { categoryId: string | null; alreadyRequested?: boolean } | null,
  selectedCategoryId: string | null,
): boolean {
  return (
    summary !== null &&
    summary.alreadyRequested === true &&
    summary.categoryId !== null &&
    summary.categoryId === selectedCategoryId
  );
}

/** 서버가 필수로 받는 방문 시간대(1개 이상)와 빈도 중 빠진 것이 있는지. 목·API 모드 모두 같은 규칙이다. */
export function isVisitInfoMissing(
  visitTimes: readonly unknown[],
  visitFrequency: unknown | null,
): boolean {
  return visitTimes.length === 0 || visitFrequency === null || visitFrequency === undefined;
}

/** 정리 결과가 바뀔 때 aria-live 로 알리는 문장. */
export function describeSummary(
  categoryLabel: string | null,
  conditions: readonly string[],
): string {
  const category = categoryLabel ? `업종 ${categoryLabel}` : '업종을 선택해 주세요';
  const condition = conditions.length > 0 ? `, 조건 ${conditions.join(', ')}` : '';
  return `요청 정리 결과: ${category}${condition}`;
}
