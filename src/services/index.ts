import type { DemandService } from './demandService';
import { mockAreaDescriptionGenerator } from './mockAreaDescriptionGenerator';
import { mockDemandService } from './mockDemandService';
import { mockFounderService } from './mockFounderService';
import { mockMerchantService } from './mockMerchantService';
import { mockMyRequestService } from './mockMyRequestService';
import { mockReportDescriptionGenerator } from './mockReportDescriptionGenerator';
import { mockRequestSubmitter } from './mockRequestSubmitter';
import { mockRequestSummarizer } from './mockRequestSummarizer';
import type { AreaDescriptionGenerator, ReportDescriptionGenerator } from './reportDescription';
import type { FounderService } from './founderService';
import type { MerchantService } from './merchantService';
import type { MyRequestService } from './myRequestService';
import type { RequestSubmitter } from './requestSubmitter';
import type { RequestSummarizer } from './requestSummarizer';

export { DEFAULT_CATEGORY_ID } from './demandService';
export type { DemandService } from './demandService';
export type { AreaReportQuery, FounderService } from './founderService';
export type {
  AreaDemandQuery,
  AreaDetailQuery,
  MerchantMapData,
  MerchantService,
} from './merchantService';
export type { MyRequestService } from './myRequestService';
export type { AreaDescriptionGenerator, ReportDescriptionGenerator } from './reportDescription';
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

/** 사장님 탐색 데이터(메모리 목). 실제 API 구현이 생기면 여기서 교체한다. */
export const merchantService: MerchantService = mockMerchantService;

/** 동네 상세 "한 줄 요약" 문장 생성(템플릿 목). 실제 AI 구현이 생기면 여기서 교체한다. */
export const areaDescriptionGenerator: AreaDescriptionGenerator = mockAreaDescriptionGenerator;

/** 예비 창업자 입지 순위(메모리 목). 실제 API 구현이 생기면 여기서 교체한다. */
export const founderService: FounderService = mockFounderService;

/** 창업자 동네 리포트 "왜 이 동네인가요?" 문장 생성(템플릿 목). 실제 AI 구현이 생기면 여기서 교체한다. */
export const reportDescriptionGenerator: ReportDescriptionGenerator =
  mockReportDescriptionGenerator;
