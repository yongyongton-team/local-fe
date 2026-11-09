import type { StoreCategory } from '@/types/domain';
import type { FounderService } from '../founderService';
import type { ReportDescriptionGenerator } from '../reportDescription';
import type { ApiClient } from './apiClient';
import { ApiError } from './apiError';
import { getApiClient } from './defaultClient';
import type { FounderRankingDto, FounderReportDto } from './dto';
import { toServerId, tryToServerId } from './ids';
import { mapFounderReport, mapRankings } from './mappers';

/**
 * 순위 요청의 limit(서버 필수). 용인시 행정동이 39곳이라 전부 담기는 값이다.
 * 서버의 최댓값은 확인하지 못했다(50 은 통과했다).
 */
export const RANKING_LIMIT = 50;

interface Options {
  /** 서버 업종 목록(세션 캐시). 리포트의 업종 표시에 쓴다. */
  listCategories: () => Promise<StoreCategory[]>;
  getClient?: () => ApiClient;
}

/** 예비 창업자 순위·리포트의 API 구현(GET /founder/rankings, GET /founder/report). FOUNDER 역할이 필요하다. */
export function createApiFounderService({ listCategories, getClient = getApiClient }: Options): {
  founderService: FounderService;
  reportDescriptionGenerator: ReportDescriptionGenerator;
} {
  const founderService: FounderService = {
    remote: true,
    async listLocationRanks(categoryId, signal) {
      const dto = await getClient().request<FounderRankingDto>('/founder/rankings', {
        query: { categoryId: toServerId(categoryId), limit: RANKING_LIMIT },
        signal,
      });
      return mapRankings(dto);
    },
    async getAreaReport({ areaId, categoryId }, signal) {
      // 라우트에서 온 값이라 숫자가 아닐 수 있다. 요청 없이 "찾을 수 없음"(null)으로 처리한다.
      const dongId = tryToServerId(areaId);
      const serverCategoryId = tryToServerId(categoryId);
      if (dongId === null || serverCategoryId === null) return null;

      const request = getClient().request<FounderReportDto>('/founder/report', {
        query: { dongId, categoryId: serverCategoryId },
        signal,
      });
      const [dto, categories] = await Promise.all([request, listCategories()]);
      return mapFounderReport(dto, { neighborhoodId: areaId, categoryId, categories });
    },
  };

  // 설명 문장은 리포트 응답(explanation)에 이미 들어 있다. 별도 호출 없이 그 문장을 돌려준다.
  const reportDescriptionGenerator: ReportDescriptionGenerator = {
    async generate(report) {
      if (!report.explanation) {
        throw new ApiError({ kind: 'parse', message: '리포트 응답에 설명 문장이 없어요.' });
      }
      return report.explanation.text;
    },
  };

  return { founderService, reportDescriptionGenerator };
}
