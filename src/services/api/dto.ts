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
