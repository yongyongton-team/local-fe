import { VISIT_TIME_LABELS } from '@/shared/lib/visitTime';
import type { ReportDescriptionGenerator } from './reportDescription';

/**
 * 템플릿으로 문장을 만드는 목. AI 를 호출하지 않는다.
 * 예: 구성동은 주민 29명이 과일·채소 가게를 원해요. 걸어서 15분 안에 같은 업종은 0곳이고,
 *     가장 가까운 대형마트는 2.4km 떨어져 있어요. 요청은 평일 저녁에 몰려 있어요.
 * - 업종 문구는 조사까지 완성된 objectPhrase 를 쓴다.
 * - 동네 이름 뒤 조사는 "은" 으로 고정이다. 지금은 모든 동네 이름이 "동"으로 끝나 받침이 있기 때문이다.
 *   받침이 없는 이름(예: "서현")이 추가되면 조사를 계산해야 한다.
 * - 대형마트 거리 데이터가 없으면 그 부분을 뺀다.
 */
export const mockReportDescriptionGenerator: ReportDescriptionGenerator = {
  async generate({ neighborhood, category, demand, peakVisitTime }) {
    const hypermarket =
      demand.nearestHypermarketKm === undefined
        ? '에요.'
        : `고, 가장 가까운 대형마트는 ${demand.nearestHypermarketKm}km 떨어져 있어요.`;
    return (
      `${neighborhood.name}은 주민 ${demand.requestCount}명이 ${category.objectPhrase} 원해요. ` +
      `걸어서 15분 안에 같은 업종은 ${demand.nearbySameCategoryCount}곳이${hypermarket} ` +
      `요청은 ${VISIT_TIME_LABELS[peakVisitTime]}에 몰려 있어요.`
    );
  },
};
