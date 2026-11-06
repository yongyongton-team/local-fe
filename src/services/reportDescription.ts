import type { NeighborhoodReport } from '@/types/domain';

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
