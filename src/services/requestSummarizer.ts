/** 입력 문장을 정리한 결과. 수치가 아니라 요청의 분류와 조건만 담는다. */
export interface RequestSummary {
  /** 문장에서 업종이 하나로 정해지면 그 id. 없거나 둘 이상이어서 모호하면 null */
  categoryId: string | null;
  /** 문장에서 찾은 조건. 예: 늦게까지 영업, 낱개 구매. 없으면 빈 배열 */
  conditions: string[];
}

/**
 * 입력 문장 → 업종·조건 정리 경계.
 * 현재 구현은 키워드 규칙의 목이고, 실제 AI 호출·SDK·환경 변수는 없다.
 * AI 를 붙일 때는 비밀 키를 브라우저에 두지 않고 서버 API 를 호출하는 구현으로 교체한다.
 * 입력 문장은 콘솔 등에 기록하지 않는다.
 */
export interface RequestSummarizer {
  summarize(text: string): Promise<RequestSummary>;
}
