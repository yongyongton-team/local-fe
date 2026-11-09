import type { Health, Me, MeShop, UserRole } from '@/types/domain';
import { ApiError } from './apiError';
import type { HealthResponseDto, MeResponseDto, ShopViewDto } from './dto';

const parseError = (message: string) => new ApiError({ kind: 'parse', message });

const asString = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback;
const asNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;
const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

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
