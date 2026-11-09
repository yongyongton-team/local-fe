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
  /**
   * 서버가 필수로 받는 시간대(1개 이상)와 빈도를 골랐는지. 목 모드는 선택 사항이라 기본 true 다.
   */
  visitInfoComplete?: boolean;
}

/**
 * 요청 보내기 활성 조건: 문장이 비어 있지 않고, 업종이 정해졌고, 정리 결과가 최신일 때.
 * 시간대와 빈도는 선택하지 않아도 보낼 수 있다(필수 여부가 디자인에서 확인되지 않음).
 * 단 서버(API 모드)는 둘을 필수로 받으므로 visitInfoComplete 가 false 이면 보내지 못한다.
 */
export function canSubmitRequest({
  text,
  categoryId,
  summaryIsCurrent,
  visitInfoComplete = true,
}: SubmitState): boolean {
  return !isBlank(text) && categoryId !== null && summaryIsCurrent && visitInfoComplete;
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
