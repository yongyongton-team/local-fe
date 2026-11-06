import type { DemandService } from './demandService';
import { mockDemandService } from './mockDemandService';

export { DEFAULT_CATEGORY_ID } from './demandService';
export type { DemandService } from './demandService';
export type { ReportDescriptionGenerator } from './reportDescription';

/** 앱이 사용하는 수요 서비스. 실제 API 구현이 생기면 여기서 교체한다. */
export const demandService: DemandService = mockDemandService;
