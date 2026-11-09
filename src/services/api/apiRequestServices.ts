import type { StoreCategory } from '@/types/domain';
import type { MyRequestService } from '../myRequestService';
import type { RequestSubmitter } from '../requestSubmitter';
import type { RequestSummarizer } from '../requestSummarizer';
import type { ApiClient } from './apiClient';
import { getApiClient } from './defaultClient';
import type { CreateResponseDto, MyRequestDto, ParseResponseDto } from './dto';
import { toServerId } from './ids';
import {
  buildCreateRequestBody,
  mapCreateResponse,
  mapMyRequests,
  mapParseResponse,
} from './mappers';

interface Options {
  /** 서버 업종 목록(세션 캐시). 정리 결과의 업종 검증과 내 요청의 업종 표시에 쓴다. */
  listCategories: () => Promise<StoreCategory[]>;
  getClient?: () => ApiClient;
}

/**
 * 요청 작성(정리·생성)과 내 요청의 API 구현. 세 서비스는 조건 라벨 → 서버 code 기록을 나눠 쓴다
 * (정리 응답이 준 label 을 생성 요청의 code 로 되돌리려고). 기록은 만든 인스턴스 안에만 있다.
 */
export function createApiRequestServices({ listCategories, getClient = getApiClient }: Options): {
  requestSummarizer: RequestSummarizer;
  requestSubmitter: RequestSubmitter;
  myRequestService: MyRequestService;
} {
  const conditionCodes = new Map<string, string>();

  const requestSummarizer: RequestSummarizer = {
    remote: true,
    async summarize(text, context) {
      // 입력 문장은 콘솔·오류에 남기지 않는다. 동네 id 가 숫자가 아니면 요청 없이 INVALID_ID.
      const dongId = toServerId(context?.neighborhoodId ?? '');
      const request = getClient().request<ParseResponseDto>('/requests/parse', {
        method: 'POST',
        body: { dongId, text },
        signal: context?.signal,
      });
      const [dto, categories] = await Promise.all([request, listCategories()]);
      return mapParseResponse(dto, categories, conditionCodes);
    },
  };

  const requestSubmitter: RequestSubmitter = {
    remote: true,
    async submit(input) {
      const body = buildCreateRequestBody(input, conditionCodes);
      const dto = await getClient().request<CreateResponseDto>('/requests', {
        method: 'POST',
        body,
      });
      return mapCreateResponse(dto, input);
    },
  };

  const myRequestService: MyRequestService = {
    remote: true,
    async listMyRequests() {
      const [dtos, categories] = await Promise.all([
        getClient().request<MyRequestDto[]>('/me/requests'),
        listCategories(),
      ]);
      return mapMyRequests(dtos, categories);
    },
  };

  return { requestSummarizer, requestSubmitter, myRequestService };
}
