import { VISIT_TIME_LABELS } from '@/shared/lib/visitTime';
import type { AreaDescriptionGenerator } from './reportDescription';

/**
 * 템플릿으로 문장을 만드는 목. AI 를 호출하지 않는다.
 * 예: 구성동에는 과일·채소 가게를 원하는 주민이 29명 있어요. 평일 저녁 방문이 좋아 보여요.
 * 업종 표기는 조사까지 완성된 objectPhrase 를 쓴다. 시간대 정보가 없으면 두 번째 문장은 생략한다.
 */
export const mockAreaDescriptionGenerator: AreaDescriptionGenerator = {
  async generate(detail) {
    const first = `${detail.neighborhood.name}에는 ${detail.category.objectPhrase} 원하는 주민이 ${detail.requestCount}명 있어요.`;
    const top = detail.visitTimes[0];
    if (!top) return first;
    return `${first} ${VISIT_TIME_LABELS[top.time]} 방문이 좋아 보여요.`;
  },
};
