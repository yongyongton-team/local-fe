import type { AreaDetail, NeighborhoodReport } from '@/types/domain';

/**
 * 리포트 "설명 문장 생성" 경계. 현재 구현체는 없다.
 *
 * - 수치·거리·순위는 구조화된 데이터(NeighborhoodReport)가 기준이다.
 * - 향후 AI 는 이 수치를 바탕으로 설명 문장만 작성한다.
 * - AI 비밀 키는 브라우저에 두지 않는다. 구현은 서버 API 를 호출하는 형태여야 한다.
 */
export interface ReportDescriptionGenerator {
  generate(report: NeighborhoodReport): Promise<string>;
}

/**
 * 사장님 동네 상세의 "한 줄 요약" 문장 생성. 위와 같은 경계 규칙을 따른다.
 * 수치(인원·시간대)는 AreaDetail 이 기준이고 문장은 그 수치만 풀어 쓴다. 주민의 원문 문장은 입력에 없다.
 * 현재 구현은 템플릿 목이며, 실제 AI 구현은 서버 API 를 호출해야 한다.
 */
export interface AreaDescriptionGenerator {
  generate(detail: AreaDetail): Promise<string>;
}
