import type {
  AreaDemand,
  AreaDetail,
  AreaReport,
  GeoBounds,
  MerchantProfile,
  Health,
  MapMarker,
  Me,
  MeShop,
  MyRequest,
  LocationRank,
  MapPosition,
  MerchantResponse,
  Neighborhood,
  NeighborhoodReport,
  NewStoreRequest,
  StoreCategory,
  StoreRequest,
  UserRole,
  VisitFrequency,
  VisitTime,
} from '@/types/domain';
import { declutterOffsets } from '../mapCoordinates';
import type { MerchantMapData } from '../merchantService';
import type { QuickRequestInput, QuickRequestResult } from '../requestSubmitter';
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
  OfferDto,
  OwnerDemandDto,
  OwnerDetailDto,
  ParseResponseDto,
  ShopViewDto,
} from './dto';
import { isNoStoreGap } from './gapStatus';
import { toDomainId, toServerId } from './ids';
import { isShownOfferStatus } from './offerStatus';
import {
  CONDITION_LABELS_BY_CODE,
  FREQUENCY_CODES,
  TIME_SLOT_CODES,
  toVisitFrequency,
  toVisitTime,
} from './requestCodes';

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

/** 요청·부족 가게 알약이 쌓이는 배치(자리표시자 지도용 상대좌표)의 세로 간격. 알약 높이(약 26px)보다 크게 잡았다. [임의] */
const PILL_STACK_STEP = 0.26;

/**
 * 유효한 동 중심 좌표({lat, lon}). 둘 다 유한한 숫자이고 위도 -90~90, 경도 -180~180 이어야 한다. 아니면 undefined.
 * OpenAPI 에 없는 필드라 없을 수 있고, 없으면 알약을 만들지 않는다(좌표를 만들어 넣지 않는다).
 */
function validCenter(dong: unknown): { lat: number; lng: number } | undefined {
  const center = isObject(dong) && isObject(dong.center) ? dong.center : null;
  const lat = center ? asNumber(center.lat) : undefined;
  const lng = center ? asNumber(center.lon) : undefined;
  if (lat === undefined || lng === undefined) return undefined;
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 ? { lat, lng } : undefined;
}

/**
 * GET /dongs/{dongId}/map 응답 → 지도 마커.
 * - stores: 좌표가 있는 가게를 'existing' 핀으로 만든다(lat, lon → lat, lng). 좌표가 없는 가게는 뺀다.
 * - requests: "{업종} 요청 {인원}" 알약('request'), gaps: "X : {업종}" 알약('missing'). 항목에 좌표가 없어서
 *   모두 dong.center 에 놓는다(위경도는 전부 같고, 흩뿌리지 않는다). dong.center 가 없거나 유효하지 않으면 알약은 없다.
 *   업종은 업종 목록에서 찾고, 없으면 항목의 이름을 쓴다. 업종 id 가 올바르지 않거나 requests 의 인원이 숫자가 아니면 그 항목은 뺀다.
 * - 같은 위치의 알약은 declutterOffsets(픽셀 오프셋)로만 푼다: 알약마다 세로로 쌓은 배치(좌표 아님)를 주고 그 오프셋을 받는다.
 * position(자리표시자 지도용 상대좌표)은 가게는 가게 좌표 범위 안에서, 알약은 쌓은 배치 그대로다.
 * 응답이 객체가 아니면 parse 오류, stores 가 없으면 가게는 없다.
 */
export function mapMapMarkers(
  dto: DongMapDto | undefined,
  categories: readonly StoreCategory[] = [],
): MapMarker[] {
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

  let pins: MapMarker[] = [];
  if (located.length > 0) {
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

    pins = located.map(({ id, lat, lng, name, categoryId }) => ({
      id: `store-${id}`,
      kind: 'existing' as const,
      ...(categoryId !== undefined && Number.isSafeInteger(categoryId) && categoryId > 0
        ? { categoryId: String(categoryId) }
        : {}),
      label: name,
      storeName: name,
      position: { x: ratio(lng, minLng, maxLng), y: 1 - ratio(lat, minLat, maxLat) },
      lat,
      lng,
    }));
  }

  const center = validCenter(dto.dong);
  if (center === undefined) return pins;

  const pills: {
    id: string;
    kind: 'request' | 'missing';
    category: StoreCategory;
    label: string;
  }[] = [];
  for (const raw of Array.isArray(dto.requests) ? dto.requests : []) {
    const item = isObject(raw) ? raw : {};
    const categoryId = safeDomainId(item.categoryId);
    const count = asNumber(item.count);
    if (categoryId === undefined || count === undefined || count < 0) continue;
    const category = categoryOf(categoryId, asString(item.name), categories);
    pills.push({
      id: `request-${categoryId}`,
      kind: 'request',
      category,
      label: `${category.requestLabel} 요청 ${count}`,
    });
  }
  for (const raw of Array.isArray(dto.gaps) ? dto.gaps : []) {
    const item = isObject(raw) ? raw : {};
    const categoryId = safeDomainId(item.categoryId);
    if (categoryId === undefined) continue;
    const category = categoryOf(categoryId, asString(item.name), categories);
    pills.push({
      id: `missing-${categoryId}`,
      kind: 'missing',
      category,
      label: `X : ${category.missingLabel}`,
    });
  }

  // 알약마다 세로로 쌓은 배치(좌표가 아니라 겹침을 풀기 위한 표시용 배치)를 만들고 그 오프셋을 받는다.
  const layout: MapPosition[] = pills.map((_, index) => ({
    x: 0.5,
    y: 0.5 + (index - (pills.length - 1) / 2) * PILL_STACK_STEP,
  }));
  const offsets = declutterOffsets(layout);
  const demandPills = pills.map(({ id, kind, category, label }, index): MapMarker => ({
    id,
    kind,
    categoryId: category.id,
    label,
    position: layout[index] ?? { x: 0.5, y: 0.5 },
    lat: center.lat,
    lng: center.lng,
    ...(offsets[index] && { offset: offsets[index] }),
  }));
  return [...pins, ...demandPills];
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
 * - alreadyRequested: boolean true 일 때만 true, 없거나 boolean 이 아니면 false.
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
  return { categoryId, conditions, alreadyRequested: dto.alreadyRequested === true };
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

/** 간편 요청 본문: {dongId, categoryId, timeSlots, frequency} 뿐이다(text·conditions 는 보내지 않는다). */
export function buildQuickRequestBody(input: QuickRequestInput): CreateRequestBody {
  return {
    dongId: toServerId(input.neighborhoodId),
    categoryId: toServerId(input.categoryId),
    timeSlots: input.visitTimes.map((time) => TIME_SLOT_CODES[time]),
    frequency: FREQUENCY_CODES[input.visitFrequency],
  };
}

/**
 * POST /requests 201 응답 → 간편 요청 결과. reachedGoal 이 true 일 때만 도달이다(없거나 다른 값이면 false).
 * notifiedOwnerCount 는 0 이상의 정수일 때만 쓰고 아니면 없음이다. 요청 id 는 쓰지 않는다.
 */
export function mapQuickResponse(dto: CreateResponseDto | undefined): QuickRequestResult {
  const body: CreateResponseDto = isObject(dto) ? dto : {};
  const notified = asNumber(body.notifiedOwnerCount);
  return {
    reachedGoal: body.reachedGoal === true,
    ...(notified !== undefined && Number.isInteger(notified) && notified >= 0
      ? { notifiedOwnerCount: notified }
      : {}),
  };
}

/** ISO 8601 문자열 → Date. 올바르지 않으면 undefined */
export function parseIsoDate(value: unknown): Date | undefined {
  if (typeof value !== 'string' || value === '') return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/**
 * 요청의 제안(offers[]) → "사장님 응답". 서버가 준 순서에서 보여줄 수 있는 첫 제안 하나를 쓴다.
 * - 보여줄 수 없는 제안: 취소됐거나 알 수 없는 상태(offerStatus.ts), 업체 이름(shopName)이 없는 것.
 * - 매핑: shopName → merchantName, pickupAt → pickupAt(ISO 8601 을 해석하지 못하면 없음), pickupPlace → pickupPlace(비면 없음).
 * 제목·가격·최소 주문·마감·주문(myOrder)은 이 화면에 담을 자리가 없어 쓰지 않는다.
 * 제안이 없거나 배열이 아니면 undefined 다.
 */
export function selectOfferResponse(
  offers: OfferDto[] | null | undefined,
): MerchantResponse | undefined {
  for (const offer of Array.isArray(offers) ? offers : []) {
    if (!isObject(offer) || !isShownOfferStatus(offer.status)) continue;
    const merchantName = asString(offer.shopName);
    if (merchantName === '') continue;
    const pickupAt = parseIsoDate(offer.pickupAt);
    const pickupPlace = asString(offer.pickupPlace).trim();
    return {
      merchantName,
      ...(pickupAt !== undefined && { pickupAt }),
      ...(pickupPlace !== '' && { pickupPlace }),
    };
  }
  return undefined;
}

/**
 * GET /me/requests 응답 → 도메인 MyRequest[]. 서버가 준 순서를 그대로 둔다.
 * 서버에 없는 값은 만들지 않고 비워 둔다: 입력 문장(detail)은 빈 문자열, conditions 는 빈 배열.
 * 동네의 구(district)는 동네 목록(neighborhoods)에서 동 id 로 찾고, 없으면 빈 문자열.
 * 사장님 응답(response)은 제안(offers[])에서 selectOfferResponse 로 만들고, 보여줄 제안이 없으면 없음. 인원은 count(없으면 0), 시각은 ISO 8601 로 파싱한 createdAt(올바르지 않으면 없음).
 * 알 수 없는 시간대·빈도 값은 건너뛴다. id 가 양의 정수가 아닌 항목이 있으면 INVALID_ID 오류, 응답이 배열이 아니면 parse 오류.
 */
export function mapMyRequests(
  dtos: MyRequestDto[] | undefined,
  categories: readonly StoreCategory[],
  neighborhoods: readonly Neighborhood[] = [],
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
    const response = selectOfferResponse(item.offers);

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
      neighborhood: {
        id: neighborhoodId,
        // 서버 요청의 동네에는 구(gu)가 없어서 동네 목록에서 찾는다. 못 찾으면 빈 문자열이다.
        district: neighborhoods.find((n) => n.id === neighborhoodId)?.district ?? '',
        name: asString(dong.name),
      },
      category: categoryOf(categoryId, asString(category.name), categories),
      requestCount: Math.max(0, asNumber(item.count) ?? 0),
      ...(createdAt !== undefined && { createdAt }),
      ...(response !== undefined && { response }),
    };
  });
}

/**
 * 순위에 올릴지 정하는 규칙(한 곳). 서버 순위는 요청이 0명인 동네까지 전부 준다(동 39곳).
 * true(현재)이면 요청이 1명 이상인 동네만 남기고 순위 번호를 보이는 행 기준으로 1부터 다시 매긴다
 * (서버 rank 는 score 순서라 0명 동네가 빠지면 번호가 건너뛴다. 예: 반찬은 요청 있는 동네가 서버 3위 하나뿐이라 1위가 된다).
 * false 이면 서버가 준 목록과 순위를 그대로 보여준다.
 */
export const HIDE_ZERO_REQUEST_RANKS = true;

const requiredCount = (value: unknown, what: string): number => {
  const count = asNumber(value);
  if (count === undefined || count < 0) throw parseError(`${what} 가 숫자가 아니에요.`);
  return count;
};

/**
 * GET /founder/rankings 응답 → 도메인 LocationRank[]. 서버 순서를 그대로 쓰고, 순위(rank)는 서버 값을 쓴다(없으면 서버 순서의 번호).
 * 요청 0명 동네를 숨기면(HIDE_ZERO_REQUEST_RANKS) 순위는 보이는 행 기준으로 다시 매긴다.
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
  if (!hideZeroRequests) return ranks;
  return ranks
    .filter((item) => item.requestCount > 0)
    .map((item, index) => ({ ...item, rank: index + 1 }));
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

/**
 * 서버 시간대 비율 → 화면의 퍼센트. 실서버 확인: ratio 는 0~1 이고 합이 1.0 이다(예: 0.59, 0.31, 0.10).
 * 서버의 단위가 바뀌면 이 상수만 고친다.
 */
export const RATIO_TO_PERCENT = 100;
export const ratioToPercent = (ratio: number): number => Math.round(ratio * RATIO_TO_PERCENT);

/**
 * GET /me 의 shop → 사장님 프로필. 가게가 없거나 업종 id 가 없으면 null(호출하는 쪽이 "가게 없음"으로 처리한다).
 * district(구)는 서버 shop 에 없어서 가게의 동 id 로 동네 목록에서 찾아 넣는다(없으면 빈 문자열).
 */
export function mapMerchantProfile(
  shop: MeShop | null,
  neighborhoods: readonly Neighborhood[],
): MerchantProfile | null {
  if (shop === null || shop.categoryId === undefined) return null;
  const dong =
    shop.dongId === undefined ? undefined : neighborhoods.find((n) => n.id === String(shop.dongId));
  return {
    shopName: shop.shopName,
    categoryId: toDomainId(shop.categoryId),
    categoryName: shop.categoryName,
    district: dong?.district ?? '',
  };
}

/**
 * GET /owner/demand 응답 → 도메인 AreaDemand[]. 서버 순서(요청 많은 순)와 거리(distanceKm)를 그대로 쓴다.
 * - 동네 id 는 문자열로 바꾼다(양의 정수가 아니면 INVALID_ID). 구(district)는 동네 목록에서 찾고 없으면 빈 문자열.
 * - requestCount·distanceKm·sameCategoryStoreCount 가 숫자가 아니면 parse 오류다(지어내지 않는다).
 *   topTimeSlot 이 없거나 알 수 없는 값이면 peakVisitTime 을 비운다.
 * 응답이 객체가 아니거나 areas 가 배열이 아니면 parse 오류.
 */
export function mapOwnerAreas(
  dto: OwnerDemandDto | undefined,
  neighborhoods: readonly Neighborhood[],
): AreaDemand[] {
  if (!isObject(dto) || !Array.isArray(dto.areas)) {
    throw parseError('GET /owner/demand 응답에 areas 가 없어요.');
  }
  return dto.areas.map((raw) => {
    const area = isObject(raw) ? raw : {};
    const id = toDomainId(area.dongId);
    const name = asString(area.name);
    if (name === '') throw parseError('GET /owner/demand 항목에 이름이 없어요.');
    const peakVisitTime = toVisitTime(area.topTimeSlot);
    return {
      neighborhood: {
        id,
        district: neighborhoods.find((n) => n.id === id)?.district ?? '',
        name,
      },
      requestCount: requiredCount(area.requestCount, 'requestCount'),
      distanceKm: requiredCount(area.distanceKm, 'distanceKm'),
      ...(peakVisitTime !== undefined && { peakVisitTime }),
      nearbySameCategoryCount: requiredCount(area.sameCategoryStoreCount, 'sameCategoryStoreCount'),
    };
  });
}

/**
 * 라벨 오프셋을 줄이는 비율(0~1). [임의] 서버 좌표는 이미 실제 거리만큼 떨어져 있어서 목 모드의 오프셋(같은 동 안에서 라벨을 풀려고 만든 값)을
 * 그대로 쓰면 알약이 지도 가장자리 밖으로 밀려 잘린다. 겹치지 않으면서 가장자리에서 덜 잘리도록 실제 지도(320·390px)로 확인해 정했다.
 */
export const OFFSET_DAMPING = 0.5;

/** 점들을 평균 위치 쪽으로 factor 만큼 모은다(factor 1 이면 그대로). 입력은 바꾸지 않는다. */
function dampenAroundMean(points: readonly MapPosition[], factor: number): MapPosition[] {
  if (points.length === 0) return [];
  const mean = {
    x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
    y: points.reduce((sum, p) => sum + p.y, 0) / points.length,
  };
  return points.map((p) => ({
    x: mean.x + (p.x - mean.x) * factor,
    y: mean.y + (p.y - mean.y) * factor,
  }));
}

/** 지도 기준점(내 가게 위치 핀)의 접근 가능한 이름. 목과 같은 문구다. */
export const MERCHANT_ORIGIN_LABEL = '내 가게 위치';

/**
 * 가게 위치와 동네 중심 좌표들을 지도 영역 대비 0~1 상대좌표로 바꾼다(자리표시자 지도용, 북쪽이 위).
 * 입력 좌표의 범위 안에서 계산한 값이라 좌표를 만들어 넣는 것이 아니다. 점이 하나뿐이면 가운데다.
 */
function relativePositions(points: readonly { lat: number; lng: number }[]): MapPosition[] {
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const [minLat, maxLat, minLng, maxLng] = [
    Math.min(...lats),
    Math.max(...lats),
    Math.min(...lngs),
    Math.max(...lngs),
  ];
  const ratio = (value: number, min: number, max: number) =>
    max > min ? (value - min) / (max - min) : 0.5;
  return points.map((p) => ({
    x: ratio(p.lng, minLng, maxLng),
    y: 1 - ratio(p.lat, minLat, maxLat),
  }));
}

/**
 * GET /owner/demand 응답 + 내 가게 → 지도 데이터.
 * - 기준점(핀·반경 원)은 서버 shop 의 실제 좌표다. 좌표가 없으면 parse 오류다.
 * - 알약은 서버가 좌표(center)를 준 동네만 만든다(좌표를 만들어 넣지 않는다). 문구는 "{업종} 요청 {인원}".
 * - areaBounds 는 "기흥구 전체"용 근사 영역으로, 호출하는 쪽이 구에 맞는 값을 넘긴다(없으면 생략).
 */
export function mapOwnerMapData(
  dto: OwnerDemandDto | undefined,
  context: {
    shop: { lat?: number; lng?: number };
    category: StoreCategory;
    areaBounds?: GeoBounds;
  },
): MerchantMapData {
  if (!isObject(dto) || !Array.isArray(dto.areas)) {
    throw parseError('GET /owner/demand 응답에 areas 가 없어요.');
  }
  const { shop } = context;
  if (shop.lat === undefined || shop.lng === undefined) {
    throw parseError('가게 응답에 좌표가 없어요.');
  }
  const located = dto.areas.flatMap((raw) => {
    const area = isObject(raw) ? raw : {};
    const id = safeDomainId(area.dongId);
    const center = isObject(area.center) ? area.center : null;
    const lat = center ? asNumber(center.lat) : undefined;
    const lng = center ? asNumber(center.lon) : undefined;
    const count = asNumber(area.requestCount);
    if (id === undefined || lat === undefined || lng === undefined || count === undefined)
      return [];
    return [{ id, lat, lng, count }];
  });

  const positions = relativePositions([{ lat: shop.lat, lng: shop.lng }, ...located]);
  const [originPosition = { x: 0.5, y: 0.5 }, ...markerPositions] = positions;
  // 가까운 동네의 알약 라벨이 겹쳐 읽히지 않게 라벨의 화면 픽셀 보정값을 만든다(목 모드와 같은 함수).
  // 좌표(lat, lng)는 서버 center 그대로이고 바꾸지 않는다. 보정은 표시 방식일 뿐이다.
  const offsets = declutterOffsets(dampenAroundMean(markerPositions, OFFSET_DAMPING));
  return {
    markers: located.map(({ id, lat, lng, count }, index) => ({
      id: `merchant-${id}-${context.category.id}`,
      kind: 'request' as const,
      categoryId: context.category.id,
      label: `${context.category.requestLabel} 요청 ${count}`,
      position: markerPositions[index] ?? originPosition,
      lat,
      lng,
      ...(offsets[index] && { offset: offsets[index] }),
    })),
    origin: {
      label: MERCHANT_ORIGIN_LABEL,
      position: originPosition,
      lat: shop.lat,
      lng: shop.lng,
      ...(context.areaBounds && { areaBounds: context.areaBounds }),
    },
  };
}

/**
 * GET /owner/demand/{dongId} 응답 → 도메인 AreaDetail.
 * - 인원(requestCount)·같은 업종 수(sameCategoryStoreCount)가 숫자가 아니면 parse 오류.
 * - 조건은 서버가 준 label 을 쓰고, label 이 없으면 확인된 코드 표(CONDITION_LABELS_BY_CODE)로, 그래도 없으면 그 조건은 뺀다.
 * - 시간대는 requestCodes 표로 도메인 VisitTime 으로 바꾸고(알 수 없는 값은 뺀다), 서버 순서(비율 내림차순)를 그대로 둔다.
 *   비율은 ratioToPercent 로 퍼센트가 된다.
 * - 요약은 서버가 준 것만 담는다(없으면 비움).
 */
export function mapOwnerDetail(
  dto: OwnerDetailDto | undefined,
  context: {
    neighborhoodId: string;
    categoryId: string;
    categories: readonly StoreCategory[];
    neighborhoods: readonly Neighborhood[];
  },
): AreaDetail {
  if (!isObject(dto)) throw parseError('GET /owner/demand/{id} 응답이 비어 있어요.');
  const dong = isObject(dto.dong) ? dto.dong : {};
  const category = isObject(dto.category) ? dto.category : {};
  const neighborhoodId = safeDomainId(dong.id) ?? context.neighborhoodId;

  const conditions = (Array.isArray(dto.conditions) ? dto.conditions : []).flatMap((raw) => {
    const item = isObject(raw) ? raw : {};
    const code = asString(item.code);
    const label = asString(item.label) || CONDITION_LABELS_BY_CODE[code] || '';
    const count = asNumber(item.count);
    return label === '' || count === undefined ? [] : [{ label, count }];
  });
  const visitTimes = (Array.isArray(dto.timeSlots) ? dto.timeSlots : []).flatMap((raw) => {
    const item = isObject(raw) ? raw : {};
    const time = toVisitTime(item.slot);
    const ratio = asNumber(item.ratio);
    return time === undefined || ratio === undefined
      ? []
      : [{ time, ratio: ratioToPercent(ratio) }];
  });
  const summary = isObject(dto.summary) ? asString(dto.summary.text) : '';
  const by = isObject(dto.summary) ? asString(dto.summary.by) : '';

  return {
    neighborhood: {
      id: neighborhoodId,
      district: context.neighborhoods.find((n) => n.id === neighborhoodId)?.district ?? '',
      name: asString(dong.name),
    },
    category: categoryOf(context.categoryId, asString(category.name), context.categories),
    requestCount: requiredCount(dto.requestCount, 'requestCount'),
    nearbySameCategoryCount: requiredCount(dto.sameCategoryStoreCount, 'sameCategoryStoreCount'),
    conditions,
    visitTimes,
    ...(summary !== '' && { summary: { text: summary, ...(by !== '' && { by }) } }),
  };
}
