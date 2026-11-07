import type { DemandService } from './demandService';
import { mockDemandService } from './mockDemandService';
import { mockMyRequestService } from './mockMyRequestService';
import { mockRequestSubmitter } from './mockRequestSubmitter';
import { mockRequestSummarizer } from './mockRequestSummarizer';
import type { MyRequestService } from './myRequestService';
import type { RequestSubmitter } from './requestSubmitter';
import type { RequestSummarizer } from './requestSummarizer';

export { DEFAULT_CATEGORY_ID } from './demandService';
export type { DemandService } from './demandService';
export type { MyRequestService } from './myRequestService';
export type { ReportDescriptionGenerator } from './reportDescription';
export type { RequestSubmitter } from './requestSubmitter';
export type { RequestSummarizer, RequestSummary } from './requestSummarizer';

/** 앱이 사용하는 수요 서비스. 실제 API 구현이 생기면 여기서 교체한다. */
export const demandService: DemandService = mockDemandService;

/** 입력 문장 정리(키워드 규칙 목). 실제 AI 구현이 생기면 여기서 교체한다. */
export const requestSummarizer: RequestSummarizer = mockRequestSummarizer;

/** 요청 제출(메모리 목). 실제 API 구현이 생기면 여기서 교체한다. */
export const requestSubmitter: RequestSubmitter = mockRequestSubmitter;

/** 내가 보낸 요청 조회(메모리 목). 실제 API 구현이 생기면 여기서 교체한다. */
export const myRequestService: MyRequestService = mockMyRequestService;
