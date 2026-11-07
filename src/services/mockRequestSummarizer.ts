import type { RequestSummarizer, RequestSummary } from './requestSummarizer';

/*
 * 키워드 규칙 목 구현. 실제 AI 분석이 아니며 규칙은 일부러 작게 유지한다.
 * 업종 id 는 mocks/demand.ts 의 업종 id 와 같다.
 */
const CATEGORY_RULES: readonly { categoryId: string; pattern: RegExp }[] = [
  { categoryId: 'fruit-vegetable', pattern: /과일|채소|야채/ },
  { categoryId: 'side-dish', pattern: /반찬/ },
  { categoryId: 'bakery', pattern: /빵|베이커리/ },
];

const CONDITION_RULES: readonly { label: string; pattern: RegExp }[] = [
  { label: '늦게까지 영업', pattern: /늦게|밤|\d+\s*시\s*까지/ },
  { label: '낱개 구매', pattern: /낱개|소량/ },
];

/** 키워드 규칙으로 문장을 정리한다. 업종이 정확히 하나일 때만 categoryId 를 정한다. */
export function summarizeByKeywords(text: string): RequestSummary {
  const matched = CATEGORY_RULES.filter((rule) => rule.pattern.test(text));
  return {
    categoryId: matched.length === 1 ? (matched[0]?.categoryId ?? null) : null,
    conditions: CONDITION_RULES.filter((rule) => rule.pattern.test(text)).map((rule) => rule.label),
  };
}

export const mockRequestSummarizer: RequestSummarizer = {
  async summarize(text) {
    return summarizeByKeywords(text);
  },
};
