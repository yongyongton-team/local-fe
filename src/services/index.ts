import { createApiAuthService } from './api/apiAuthService';
import { createApiDemandService } from './api/apiDemandService';
import { createApiFounderService } from './api/apiFounderService';
import { createApiMerchantService } from './api/apiMerchantService';
import { createApiMeService } from './api/apiMeService';
import { createApiOfferService } from './api/apiOfferService';
import { createApiOrderService } from './api/apiOrderService';
import { createApiRequestServices } from './api/apiRequestServices';
import { isDemoLoginEnabled, resolveDataSource } from './api/config';
import type { AuthService } from './authService';
import type { DemandService } from './demandService';
import { mockAuthService } from './mockAuthService';
import { mockMeService } from './mockMeService';
import { mockAreaDescriptionGenerator } from './mockAreaDescriptionGenerator';
import { mockDemandService } from './mockDemandService';
import { mockFounderService } from './mockFounderService';
import { mockMerchantService } from './mockMerchantService';
import { mockOfferService } from './mockOfferService';
import { mockOrderService } from './mockOrderService';
import { mockMyRequestService } from './mockMyRequestService';
import { mockReportDescriptionGenerator } from './mockReportDescriptionGenerator';
import { mockRequestSubmitter } from './mockRequestSubmitter';
import { mockRequestSummarizer } from './mockRequestSummarizer';
import type { AreaDescriptionGenerator, ReportDescriptionGenerator } from './reportDescription';
import type { FounderService } from './founderService';
import type { MeService } from './meService';
import type { MerchantService } from './merchantService';
import type { OfferService } from './offerService';
import type { OrderService } from './orderService';
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
export type { OfferService } from './offerService';
export type { OrderService } from './orderService';
export { isNoShopError, NoShopError } from './merchantService';
export type { AreaDescriptionGenerator, ReportDescriptionGenerator } from './reportDescription';
export type { RequestSubmitter } from './requestSubmitter';
export type { RequestSummarizer, RequestSummary } from './requestSummarizer';

/*
 * 목/API 전환. VITE_DATA_SOURCE(mock | api, 기본 mock; 비어 있거나 잘못된 값도 mock)가 아래 모든 서비스의 구현을 한꺼번에 고른다.
 * - api: 아래에서 내보내는 서비스는 모두 서버를 쓴다. 인증(authService), 내 정보·역할·가게 저장(meService),
 *   동네·업종 목록·주민 조회·지도 마커(demandService), 요청 정리·작성(requestSummarizer·requestSubmitter)과 내 요청(myRequestService),
 *   예비 창업자 순위·리포트(founderService·reportDescriptionGenerator),
 *   사장님 가게 정보·동네 수요(merchantService·areaDescriptionGenerator)와 제안(offerService).
 * - mock: 같은 서비스를 메모리 목으로 쓴다. 네트워크 요청과 로그인이 전혀 일어나지 않는다.
 * 주민의 선주문·예약 취소(orderService)도 api 모드에서는 서버를 쓴다.
 */
const dataSource = resolveDataSource(
  import.meta.env.VITE_DATA_SOURCE,
  // 잘못된 값은 mock 으로 처리하고, 개발 환경에서만 알린다.
  import.meta.env.DEV
    ? (value) =>
        console.warn(
          `VITE_DATA_SOURCE 값 "${value}" 은 지원하지 않아 mock 으로 처리해요(mock | api).`,
        )
    : undefined,
);

/** 앱이 사용하는 수요 서비스. api 모드에서는 모든 메서드가 서버(동네·업종 목록, 주민 조회, 지도 마커, 기본 업종)다. */
export const demandService: DemandService =
  dataSource === 'api' ? createApiDemandService(mockDemandService) : mockDemandService;

/** 요청 작성(정리·생성)과 내 요청. api 모드에서만 만들고, 세 서비스가 조건 code 기록을 나눠 쓴다. */
const apiRequestServices =
  dataSource === 'api'
    ? createApiRequestServices({
        listCategories: () => demandService.listCategories(),
        listNeighborhoods: () => demandService.listNeighborhoods(),
      })
    : null;

/** 입력 문장 정리. api 모드는 POST /requests/parse(AI), mock 은 키워드 규칙. */
export const requestSummarizer: RequestSummarizer =
  apiRequestServices?.requestSummarizer ?? mockRequestSummarizer;

/** 요청 제출. api 모드는 POST /requests, mock 은 메모리에만 저장한다. */
export const requestSubmitter: RequestSubmitter =
  apiRequestServices?.requestSubmitter ?? mockRequestSubmitter;

/** 내가 보낸 요청 조회. api 모드는 GET /me/requests, mock 은 메모리 목. */
export const myRequestService: MyRequestService =
  apiRequestServices?.myRequestService ?? mockMyRequestService;

/** 사장님 가게 정보·동네 수요·상세와 한 줄 요약. api 모드는 GET /me 의 shop·GET /owner/demand*, mock 은 메모리 목·템플릿. */
const apiMerchantServices =
  dataSource === 'api'
    ? createApiMerchantService({
        listCategories: () => demandService.listCategories(),
        listNeighborhoods: () => demandService.listNeighborhoods(),
      })
    : null;

/** 사장님 탐색 데이터. */
export const merchantService: MerchantService =
  apiMerchantServices?.merchantService ?? mockMerchantService;

/** 동네 상세 "한 줄 요약" 문장. api 모드는 서버가 쓴 요약, mock 은 템플릿 목. */
export const areaDescriptionGenerator: AreaDescriptionGenerator =
  apiMerchantServices?.areaDescriptionGenerator ?? mockAreaDescriptionGenerator;

/** 예비 창업자 순위·리포트와 리포트 설명. api 모드는 GET /founder/*(설명은 리포트 응답의 문장), mock 은 메모리 목·템플릿. */
const apiFounderServices =
  dataSource === 'api'
    ? createApiFounderService({ listCategories: () => demandService.listCategories() })
    : null;

/** 예비 창업자 입지 순위·리포트 수치. */
export const founderService: FounderService =
  apiFounderServices?.founderService ?? mockFounderService;

/** 창업자 동네 리포트 "왜 이 동네인가요?" 문장. api 모드는 서버가 쓴 문장, mock 은 템플릿 목. */
export const reportDescriptionGenerator: ReportDescriptionGenerator =
  apiFounderServices?.reportDescriptionGenerator ?? mockReportDescriptionGenerator;

/** 사장님 방문 판매 제안 목록·보내기. api 모드는 GET /owner/offers·POST /offers(데모 세션은 쓰기 차단), mock 은 메모리 목. */
export const offerService: OfferService =
  dataSource === 'api' ? createApiOfferService() : mockOfferService;

/** 주민의 선주문·예약 취소. api 모드는 POST /offers/{id}/orders·DELETE /orders/{id}(데모 세션은 차단), mock 은 서버 규칙을 따르는 메모리 목. */
export const orderService: OrderService =
  dataSource === 'api' ? createApiOrderService() : mockOrderService;

/** 인증. api 모드는 게스트 로그인(+ 플래그가 켜진 경우 사장님 데모 로그인), mock 은 아무것도 하지 않는다. */
export const authService: AuthService =
  dataSource === 'api'
    ? createApiAuthService(
        undefined,
        isDemoLoginEnabled(dataSource, import.meta.env.VITE_ENABLE_DEMO_LOGIN),
      )
    : mockAuthService;

export const meService: MeService = dataSource === 'api' ? createApiMeService() : mockMeService;

export { isApiError } from './api/apiError';
export {
  DEMO_WRITE_BLOCKED_MESSAGE,
  ERROR_MESSAGES_BY_CODE,
  NOT_FOUND_MESSAGES_BY_CONTEXT,
  ORDER_MESSAGES_BY_CODE,
  VALIDATION_MESSAGES_BY_CONTEXT,
  describeApiError,
} from './api/errorMessages';
export type { ErrorContext } from './api/errorMessages';
