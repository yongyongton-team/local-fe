import type {
  AreaReport,
  Health,
  MapMarker,
  Me,
  MeShop,
  MyRequest,
  LocationRank,
  Neighborhood,
  NeighborhoodReport,
  NewStoreRequest,
  StoreCategory,
  StoreRequest,
  UserRole,
  VisitFrequency,
  VisitTime,
} from '@/types/domain';
import type { RequestSummary } from '../requestSummarizer';
import { ApiError } from './apiError';
import { labelsFor } from './categoryLabels';
import type {
  CategoryDto,
  CreateRequestBody,
  CreateResponseDto,
  DongDto,
  DongMapDto,
  GapDto,
  FounderRankingDto,
  FounderReportDto,
  HealthResponseDto,
  MeResponseDto,
  MyRequestDto,
  ParseResponseDto,
  ShopViewDto,
} from './dto';
import { isNoStoreGap } from './gapStatus';
import { toDomainId, toServerId } from './ids';
import { FREQUENCY_CODES, TIME_SLOT_CODES, toVisitFrequency, toVisitTime } from './requestCodes';

const parseError = (message: string) => new ApiError({ kind: 'parse', message });

const asString = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback;
const asNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;
const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** 서버 역할 코드 */
export type ServerRole = 'RESIDENT' | 'OWNER' | 'FOUNDER';

/** 화면 역할 → 서버 역할 코드. 알 수 없는 값이면 null(호출하는 쪽이 오류로 처리한다). mapRole 의 반대 방향이다. */
export function toServerRole(role: unknown): ServerRole | null {
  switch (role) {
    case 'resident':
      return 'RESIDENT';
    case 'merchant':
      return 'OWNER';
    case 'founder':
      return 'FOUNDER';
    default:
      return null;
  }
}

/** 서버 역할 → 화면 역할. 알 수 없는 값이나 없으면 null. */
export function mapRole(role: unknown): UserRole | null {
  switch (role) {
    case 'RESIDENT':
      return 'resident';
    case 'OWNER':
      return 'merchant';
    case 'FOUNDER':
      return 'founder';
    default:
      return null;
  }
}

/** 가게 정보. 가게가 없거나(null·없음) 이름이 없으면 null. 좌표가 없으면 lat·lng 만 비운다. */
export function mapShop(dto: ShopViewDto | null | undefined): MeShop | null {
  if (!isObject(dto)) return null;
  const shopName = asString(dto.shopName);
  if (shopName === '') return null;
  const category = isObject(dto.category) ? dto.category : {};
  const dong = isObject(dto.dong) ? dto.dong : {};
  const lat = asNumber(dto.lat);
  const lng = asNumber(dto.lon);
  const categoryId = asNumber(category.id);
  const dongId = asNumber(dong.id);
  return {
    shopName,
    categoryName: asString(category.name),
    dongName: asString(dong.name),
    ...(categoryId !== undefined && { categoryId }),
    ...(dongId !== undefined && { dongId }),
    ...(lat !== undefined && { lat }),
    ...(lng !== undefined && { lng }),
  };
}

/**
 * GET /me 응답 → 도메인 Me. 응답이 객체가 아니거나 id 가 없으면 parse 오류(사용자를 식별할 수 없다).
 * 나머지 누락은 기본값으로 처리한다: nickname 은 빈 문자열, role·dong·shop 은 null.
 */
export function mapMe(response: MeResponseDto | undefined): Me {
  if (!isObject(response)) throw parseError('GET /me 응답이 비어 있어요.');
  const dto: MeResponseDto = response;
  const id = asNumber(dto.id);
  if (id === undefined) throw parseError('GET /me 응답에 id 가 없어요.');

  const dongDto = isObject(dto.dong) ? dto.dong : null;
  const dongId = dongDto ? asNumber(dongDto.id) : undefined;
  return {
    id,
    nickname: asString(dto.nickname),
    role: mapRole(dto.role),
    dong:
      dongDto && dongId !== undefined
        ? { id: dongId, name: asString(dongDto.name), district: asString(dongDto.gu) }
        : null,
    shop: mapShop(dto.shop as ShopViewDto | null | undefined),
  };
}

/** GET /health 응답 → 문자열 값만 남긴 객체. 객체가 아니면 빈 객체(200 이면 서버가 응답한 것이다). */
export function mapHealth(dto: HealthResponseDto | undefined): Health {
  const details: Record<string, string> = {};
  if (isObject(dto)) {
    for (const [key, value] of Object.entries(dto)) {
      if (typeof value === 'string') details[key] = value;
    }
  }
  return { details };
}

/**
 * GET /dongs 응답 → 도메인 Neighborhood[]. 서버 순서(구 가나다 → 동 가나다)를 그대로 둔다.
 * id 가 양의 정수가 아니거나 이름이 없는 항목이 있으면 parse 오류다(식별할 수 없는 동네를 고르게 할 수 없다).
 * 구(gu)가 없으면 district 는 빈 문자열이다. 응답이 배열이 아니면 parse 오류.
 */
export function mapDongs(dtos: DongDto[] | undefined): Neighborhood[] {
  if (!Array.isArray(dtos)) throw parseError('GET /dongs 응답이 배열이 아니에요.');
  return dtos.map((dto) => {
    const item: DongDto = isObject(dto) ? dto : {};
    const name = asString(item.name);
    if (name === '') throw parseError('GET /dongs 항목에 이름이 없어요.');
    return { id: toDomainId(item.id), district: asString(item.gu), name };
  });
}

/**
 * GET /categories 응답 → 도메인 StoreCategory[]. id 는 문자열로 바꾼다(양의 정수가 아니면 parse 오류).
 * 표시용 문구는 code 기준 표(categoryLabels)로 채우고, 표에 없는 code 는 서버 name 으로 대체한다.
 * name 이 없으면 code 로 대신하고, 둘 다 없으면 parse 오류다. martCheck 가 없으면 false.
 */
export function mapCategories(dtos: CategoryDto[] | undefined): StoreCategory[] {
  if (!Array.isArray(dtos)) throw parseError('GET /categories 응답이 배열이 아니에요.');
  return dtos.map((dto) => {
    const item: CategoryDto = isObject(dto) ? dto : {};
    const code = asString(item.code);
    const name = asString(item.name) || code;
    if (name === '') throw parseError('GET /categories 항목에 이름과 code 가 없어요.');
    return {
      id: toDomainId(item.id),
      name,
      ...labelsFor(code, name),
      martCheck: item.martCheck === true,
    };
  });
}

/** 업종 목록에서 기본 업종의 id. code FRUIT_VEG 가 있으면 그것, 없으면 첫 업종. 목록이 비어 있으면 undefined. */
export function pickDefaultCategoryId(dtos: CategoryDto[] | undefined): string | undefined {
  if (!Array.isArray(dtos)) return undefined;
  const chosen = dtos.find((dto) => isObject(dto) && dto.code === 'FRUIT_VEG') ?? dtos[0];
  return isObject(chosen) ? toDomainId(chosen.id) : undefined;
}

interface GapContext {
  neighborhood: Neighborhood;
  categories: readonly StoreCategory[];
}

/**
 * GET /dongs/{dongId}/gaps 응답 → 도메인 NeighborhoodReport[]. 서버 순서를 그대로 둔다(정렬은 화면 규칙이 한다).
 * - categoryId 는 문자열로 바꾼다(양의 정수가 아니면 INVALID_ID). 업종 정보는 업종 목록에서 찾고,
 *   목록에 없으면 항목의 name 으로 대체한다.
 * - status 로 보여줄 항목만 남긴다(isNoStoreGap). 남긴 항목은 "주변 같은 업종 가게 0곳" 후보라
 *   nearbySameCategoryCount 를 0 으로 둔다(서버가 가게 수를 주지 않는다).
 * - nearestMart 가 null 이거나 km 가 숫자가 아니면 nearestHypermarketKm 을 비워 화면에 표시하지 않는다.
 * - requestCount 가 없으면 0, myRequested 는 true 일 때만 true.
 */
export function mapGaps(dtos: GapDto[] | undefined, context: GapContext): NeighborhoodReport[] {
  if (!Array.isArray(dtos)) throw parseError('GET /dongs/{id}/gaps 응답이 배열이 아니에요.');
  const reports: NeighborhoodReport[] = [];
  for (const dto of dtos) {
    const item: GapDto = isObject(dto) ? dto : {};
    const categoryId = toDomainId(item.categoryId);
    if (!isNoStoreGap(item.status)) continue;

    const name = asString(item.name);
    const category = context.categories.find((c) => c.id === categoryId) ?? {
      id: categoryId,
      name,
      ...labelsFor('', name),
    };
    const km = isObject(item.nearestMart) ? asNumber(item.nearestMart.km) : undefined;
    reports.push({
      neighborhood: context.neighborhood,
      category,
      demand: {
        neighborhoodId: context.neighborhood.id,
        categoryId,
        requestCount: Math.max(0, asNumber(item.requestCount) ?? 0),
        nearbySameCategoryCount: 0,
        ...(km !== undefined && km >= 0 && { nearestHypermarketKm: km }),
        requestedByMe: item.myRequested === true,
      },
    });
  }
  return reports;
}

/**
 * GET /dongs/{dongId}/map 응답 → 지도 마커. 좌표가 있는 stores 만 'existing' 마커로 만든다(lat, lon → lat, lng).
 * 좌표가 없거나 숫자가 아닌 가게, id 가 없는 가게는 빼고, 요청·없는 가게는 좌표가 없어 마커로 만들지 않는다
 * (동네 중심 등으로 좌표를 만들어 넣지 않는다). stores 가 없으면 빈 배열, 응답이 객체가 아니면 parse 오류.
 * position(자리표시자 지도용 상대좌표)은 마커 좌표의 범위 안에서 계산한 값이다(북쪽이 위).
 */
export function mapMapMarkers(dto: DongMapDto | undefined): MapMarker[] {
  if (!isObject(dto)) throw parseError('GET /dongs/{id}/map 응답이 비어 있어요.');
  const stores = Array.isArray(dto.stores) ? dto.stores : [];

  const located = stores.flatMap((store) => {
    if (!isObject(store)) return [];
    const id = asNumber(store.id);
    const lat = asNumber(store.lat);
    const lng = asNumber(store.lon);
    if (id === undefined || lat === undefined || lng === undefined) return [];
    const categoryId = asNumber(store.categoryId);
    return [{ id, lat, lng, name: asString(store.name), categoryId }];
  });
  if (located.length === 0) return [];

  const lats = located.map((s) => s.lat);
  const lngs = located.map((s) => s.lng);
  const [minLat, maxLat, minLng, maxLng] = [
    Math.min(...lats),
    Math.max(...lats),
    Math.min(...lngs),
    Math.max(...lngs),
  ];
  const ratio = (value: number, min: number, max: number) =>
    max > min ? (value - min) / (max - min) : 0.5;

  return located.map(({ id, lat, lng, name, categoryId }) => ({
    id: `store-${id}`,
    kind: 'existing' as const,
    ...(categoryId !== undefined && Number.isSafeInteger(categoryId) && categoryId > 0
      ? { categoryId: String(categoryId) }
      : {}),
    label: name,
    position: { x: ratio(lng, minLng, maxLng), y: 1 - ratio(lat, minLat, maxLat) },
    lat,
    lng,
  }));
}

/** 서버 id 가 양의 정수면 문자열 id, 아니면 undefined(예외를 던지지 않는다). */
function safeDomainId(id: unknown): string | undefined {
  return typeof id === 'number' && Number.isSafeInteger(id) && id > 0 ? String(id) : undefined;
}

/** 업종 목록에서 id 로 찾고, 목록에 없으면 서버가 준 이름으로 대체한다(이름도 없으면 빈 이름). */
function categoryOf(id: string, name: string, categories: readonly StoreCategory[]): StoreCategory {
  return categories.find((c) => c.id === id) ?? { id, name, ...labelsFor('', name) };
}

/**
 * POST /requests/parse 응답 → 도메인 RequestSummary.
 * - categoryId: 응답의 업종 id 를 문자열로 바꾸되, 업종 목록에 없거나 id 가 올바르지 않으면 null(선택 없음)이다.
 * - conditions: 서버가 준 label 을 쓴다(label 이 없으면 code). label → code 쌍을 conditionCodes 에 기록해
 *   요청 생성 때 code 로 되돌린다(서버 enum 이라 화면 문구와 따로 관리하지 않는다).
 * 응답이 객체가 아니면 parse 오류.
 */
export function mapParseResponse(
  dto: ParseResponseDto | undefined,
  categories: readonly StoreCategory[],
  conditionCodes: Map<string, string>,
): RequestSummary {
  if (!isObject(dto)) throw parseError('POST /requests/parse 응답이 비어 있어요.');
  const id = isObject(dto.category) ? safeDomainId(dto.category.id) : undefined;
  const categoryId = id !== undefined && categories.some((c) => c.id === id) ? id : null;

  const conditions: string[] = [];
  for (const item of Array.isArray(dto.conditions) ? dto.conditions : []) {
    if (!isObject(item)) continue;
    const code = asString(item.code);
    const label = asString(item.label) || code;
    if (code === '' || label === '') continue;
    conditionCodes.set(label, code);
    conditions.push(label);
  }
  return { categoryId, conditions };
}

/**
 * 도메인 NewStoreRequest → POST /requests 본문. 동네·업종 id 는 숫자로 바꾼다(숫자가 아니면 INVALID_ID).
 * - detail → text, visitTimes → timeSlots, visitFrequency → frequency(표: requestCodes.ts).
 * - conditions(라벨)는 parse 때 기록한 code 로 바꾸고, 기록에 없는 라벨은 보내지 않는다.
 * - 서버가 받지 않는 도메인 필드는 없다. 시간대·빈도가 없으면 그 필드를 비워 보낸다(서버가 필수로 거절한다).
 */
export function buildCreateRequestBody(
  input: NewStoreRequest,
  conditionCodes: ReadonlyMap<string, string>,
): CreateRequestBody {
  return {
    dongId: toServerId(input.neighborhoodId),
    categoryId: toServerId(input.categoryId),
    text: input.detail,
    conditions: input.conditions.flatMap((label) => conditionCodes.get(label) ?? []),
    timeSlots: input.visitTimes.map((time) => TIME_SLOT_CODES[time]),
    ...(input.visitFrequency !== undefined && { frequency: FREQUENCY_CODES[input.visitFrequency] }),
  };
}

/** POST /requests 201 응답 → 저장된 도메인 StoreRequest. 응답의 request.id 가 없으면 parse 오류(만들어졌는지 알 수 없다). */
export function mapCreateResponse(
  dto: CreateResponseDto | undefined,
  input: NewStoreRequest,
): StoreRequest {
  const request = isObject(dto) && isObject(dto.request) ? dto.request : null;
  const id = request ? safeDomainId(request.id) : undefined;
  if (id === undefined) throw parseError('POST /requests 응답에 요청 id 가 없어요.');
  return { ...input, id };
}

/** ISO 8601 문자열 → Date. 올바르지 않으면 undefined */
export function parseIsoDate(value: unknown): Date | undefined {
  if (typeof value !== 'string' || value === '') return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/**
 * GET /me/requests 응답 → 도메인 MyRequest[]. 서버가 준 순서를 그대로 둔다.
 * 서버에 없는 값은 만들지 않고 비워 둔다: 입력 문장(detail)은 빈 문자열, conditions 는 빈 배열, 동네의 구(district)는 빈 문자열,
 * 사장님 응답(response)은 없음. 인원은 count(없으면 0), 시각은 ISO 8601 로 파싱한 createdAt(올바르지 않으면 없음).
 * 알 수 없는 시간대·빈도 값은 건너뛴다. id 가 양의 정수가 아닌 항목이 있으면 INVALID_ID 오류, 응답이 배열이 아니면 parse 오류.
 */
export function mapMyRequests(
  dtos: MyRequestDto[] | undefined,
  categories: readonly StoreCategory[],
): MyRequest[] {
  if (!Array.isArray(dtos)) throw parseError('GET /me/requests 응답이 배열이 아니에요.');
  return dtos.map((dto) => {
    const item: MyRequestDto = isObject(dto) ? dto : {};
    const dong = isObject(item.dong) ? item.dong : {};
    const category = isObject(item.category) ? item.category : {};
    const id = toDomainId(item.id);
    const neighborhoodId = toDomainId(dong.id);
    const categoryId = toDomainId(category.id);

    const visitTimes = (Array.isArray(item.timeSlots) ? item.timeSlots : []).flatMap(
      (code) => toVisitTime(code) ?? [],
    ) satisfies VisitTime[];
    const visitFrequency: VisitFrequency | undefined = toVisitFrequency(item.frequency);
    const createdAt = parseIsoDate(item.createdAt);

    return {
      request: {
        id,
        neighborhoodId,
        categoryId,
        detail: '',
        conditions: [],
        visitTimes,
        ...(visitFrequency !== undefined && { visitFrequency }),
      },
      neighborhood: { id: neighborhoodId, district: '', name: asString(dong.name) },
      category: categoryOf(categoryId, asString(category.name), categories),
      requestCount: Math.max(0, asNumber(item.count) ?? 0),
      ...(createdAt !== undefined && { createdAt }),
    };
  });
}

/**
 * 순위에 올릴지 정하는 규칙(한 곳). 서버 순위는 요청이 0명인 동네까지 전부 준다(동 39곳).
 * false 이면 서버가 준 목록을 그대로 보여주고, true 로 바꾸면 요청이 1명 이상인 동네만 남긴다(순위 번호는 서버 값 그대로).
 */
export const HIDE_ZERO_REQUEST_RANKS = false;

const requiredCount = (value: unknown, what: string): number => {
  const count = asNumber(value);
  if (count === undefined || count < 0) throw parseError(`${what} 가 숫자가 아니에요.`);
  return count;
};

/**
 * GET /founder/rankings 응답 → 도메인 LocationRank[]. 서버 순서와 순위(rank)를 그대로 쓴다(rank 가 없으면 서버 순서의 번호).
 * - 동네 id 는 문자열로 바꾼다(양의 정수가 아니면 INVALID_ID). 이름이 없으면 parse 오류.
 *   서버 순위에는 구(gu)가 없어 district 는 빈 문자열이다.
 * - requestCount·sameCategoryStoreCount 가 숫자가 아니면 parse 오류다(지어내지 않는다). nearestMartKm 이 없으면 비운다.
 * - 서버 순위에는 좌표가 없어 lat·lng·position 을 만들어 넣지 않는다. score 는 쓰지 않는다.
 * 응답이 객체가 아니거나 items 가 배열이 아니면 parse 오류.
 */
export function mapRankings(
  dto: FounderRankingDto | undefined,
  /** 테스트용으로 규칙을 바꿔 끼울 수 있다. 기본은 HIDE_ZERO_REQUEST_RANKS */
  hideZeroRequests: boolean = HIDE_ZERO_REQUEST_RANKS,
): LocationRank[] {
  if (!isObject(dto) || !Array.isArray(dto.items)) {
    throw parseError('GET /founder/rankings 응답에 items 가 없어요.');
  }
  const ranks = dto.items.map((raw, index): LocationRank => {
    const item = isObject(raw) ? raw : {};
    const name = asString(item.name);
    if (name === '') throw parseError('GET /founder/rankings 항목에 이름이 없어요.');
    const km = asNumber(item.nearestMartKm);
    return {
      rank: asNumber(item.rank) ?? index + 1,
      neighborhood: { id: toDomainId(item.dongId), district: '', name },
      requestCount: requiredCount(item.requestCount, 'requestCount'),
      nearbySameCategoryCount: requiredCount(item.sameCategoryStoreCount, 'sameCategoryStoreCount'),
      ...(km !== undefined && km >= 0 && { nearestHypermarketKm: km }),
    };
  });
  return hideZeroRequests ? ranks.filter((item) => item.requestCount > 0) : ranks;
}

/**
 * GET /founder/report 응답 → 도메인 AreaReport.
 * - stats.requestCount·walkStoreCount(반경 walkRadiusM 안 같은 업종 가게 수)는 숫자가 아니면 parse 오류.
 * - nearestMart 가 없으면 거리를 비우고, topTimeSlot 이 null(요청 없음)이거나 알 수 없는 값이면 peakVisitTime 을 비운다.
 * - 설명 문장(explanation)과 근거(sources)는 서버가 준 것만 담고, 없으면 비운다.
 * - 동네는 응답의 dong(구 gu 포함)으로, 업종은 업종 목록에서 찾고 없으면 응답의 이름으로 만든다.
 *   dong.id 가 없으면 요청한 동네 id 를 쓴다.
 * topConditions·offers·walkRadiusM 은 아직 화면이 쓰지 않아 담지 않는다.
 */
export function mapFounderReport(
  dto: FounderReportDto | undefined,
  context: { neighborhoodId: string; categoryId: string; categories: readonly StoreCategory[] },
): AreaReport {
  if (!isObject(dto) || !isObject(dto.stats)) {
    throw parseError('GET /founder/report 응답에 stats 가 없어요.');
  }
  const stats = dto.stats;
  const dong = isObject(dto.dong) ? dto.dong : {};
  const category = isObject(dto.category) ? dto.category : {};
  const neighborhoodId = safeDomainId(dong.id) ?? context.neighborhoodId;
  const km = isObject(stats.nearestMart) ? asNumber(stats.nearestMart.km) : undefined;
  const peakVisitTime = toVisitTime(stats.topTimeSlot);
  const explanation = isObject(dto.explanation) ? asString(dto.explanation.text) : '';
  const by = isObject(dto.explanation) ? asString(dto.explanation.by) : '';
  const sources = (Array.isArray(dto.sources) ? dto.sources : []).flatMap((source) => {
    const name = isObject(source) ? asString(source.name) : '';
    if (name === '') return [];
    const asOf = isObject(source) ? asString(source.asOf) : '';
    return [{ name, ...(asOf !== '' && { asOf }) }];
  });

  return {
    neighborhood: { id: neighborhoodId, district: asString(dong.gu), name: asString(dong.name) },
    category: categoryOf(context.categoryId, asString(category.name), context.categories),
    demand: {
      neighborhoodId,
      categoryId: context.categoryId,
      requestCount: requiredCount(stats.requestCount, 'stats.requestCount'),
      nearbySameCategoryCount: requiredCount(stats.walkStoreCount, 'stats.walkStoreCount'),
      ...(km !== undefined && km >= 0 && { nearestHypermarketKm: km }),
    },
    ...(peakVisitTime !== undefined && { peakVisitTime }),
    ...(explanation !== '' && { explanation: { text: explanation, ...(by !== '' && { by }) } }),
    ...(sources.length > 0 && { sources }),
  };
}
