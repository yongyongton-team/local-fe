/*
 * 서버 응답 DTO. 명세(OpenAPI)의 응답 스키마에는 required 가 없어 모든 필드를 선택(없거나 null)으로 적는다.
 * 필요한 필드만 손으로 적고, 도메인 타입으로의 변환과 누락 처리는 mappers.ts 가 맡는다.
 */
export type Nullable<T> = T | null | undefined;

export interface UserSummaryDto {
  id?: Nullable<number>;
  nickname?: Nullable<string>;
  role?: Nullable<string>;
  dongId?: Nullable<number>;
}

/** POST /auth/guest */
export interface AuthResponseDto {
  accessToken?: Nullable<string>;
  /** 단위는 명세에 없다. 만료 시각은 JWT 의 exp 를 우선하고 없을 때만 이 값을 쓴다(session.ts). */
  expiresIn?: Nullable<number>;
  isNew?: Nullable<boolean>;
  user?: Nullable<UserSummaryDto>;
}

export interface DongViewDto {
  id?: Nullable<number>;
  name?: Nullable<string>;
  gu?: Nullable<string>;
}

export interface ShopViewDto {
  shopName?: Nullable<string>;
  category?: Nullable<{ id?: Nullable<number>; name?: Nullable<string> }>;
  dong?: Nullable<{ id?: Nullable<number>; name?: Nullable<string> }>;
  lat?: Nullable<number>;
  lon?: Nullable<number>;
}

/** GET /me */
export interface MeResponseDto {
  id?: Nullable<number>;
  nickname?: Nullable<string>;
  role?: Nullable<string>;
  dong?: Nullable<DongViewDto>;
  shop?: Nullable<ShopViewDto>;
}

/** GET /health: 문자열 값의 객체(키는 명세에 없다) */
export type HealthResponseDto = Record<string, unknown>;

/** GET /dongs 의 항목 */
export interface DongDto {
  id?: Nullable<number>;
  name?: Nullable<string>;
  gu?: Nullable<string>;
}

/** GET /categories 의 항목 */
export interface CategoryDto {
  id?: Nullable<number>;
  code?: Nullable<string>;
  name?: Nullable<string>;
  martCheck?: Nullable<boolean>;
}

/** GET /dongs/{dongId}/gaps 의 항목 */
export interface GapDto {
  categoryId?: Nullable<number>;
  name?: Nullable<string>;
  /** 값의 종류와 뜻이 명세에 없다(gapStatus.ts) */
  status?: Nullable<string>;
  requestCount?: Nullable<number>;
  /** 없을 수 있다(null) */
  nearestMart?: Nullable<{ name?: Nullable<string>; km?: Nullable<number> }>;
  myRequested?: Nullable<boolean>;
}

/** GET /dongs/{dongId}/map 의 가게. 좌표는 lat·lon 이다. */
export interface MapStoreDto {
  id?: Nullable<number>;
  name?: Nullable<string>;
  categoryId?: Nullable<number>;
  lat?: Nullable<number>;
  lon?: Nullable<number>;
}

/**
 * GET /dongs/{dongId}/map. 마커로 쓰는 것은 stores 뿐이다.
 * requests·gaps 는 좌표가 없고(명세와 실제 응답 모두), marts 는 쓰지 않는다.
 */
export interface DongMapDto {
  stores?: Nullable<MapStoreDto[]>;
}
