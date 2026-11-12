/** 화면 이동에 쓰는 경로. 라우트 패턴(app/routes.tsx)과 짝을 이룬다. */
export const paths = {
  home: '/',
  /** 내 정보. 진입 링크는 아직 없다(디자인 대기). */
  me: '/me',
  /** 동네 선택(내 정보에서 들어간다) */
  meDong: '/me/dong',
  /** 내 가게 등록·수정(사장님). 내 정보에서 들어간다. */
  meShop: '/me/shop',
  resident: '/resident',
  residentRequestNew: '/resident/requests/new',
  residentRequests: '/resident/requests',
  merchant: '/merchant',
  merchantArea: (areaId: string) => `/merchant/areas/${encodeURIComponent(areaId)}`,
  /**
   * 내 가게(제안 목록). areaId 가 있으면 ?area= 로 요약 카드의 동네를 정한다(없으면 가게가 있는 동네).
   * 내 정보의 "내 가게"(/me/shop, 가게 등록·수정)와 다른 화면이다.
   */
  merchantOffers: (areaId?: string) =>
    `/merchant/offers${areaId ? `?area=${encodeURIComponent(areaId)}` : ''}`,
  /** 방문 판매 제안 작성. areaId 가 있으면 ?area= 의 동네에 제안한다(없으면 가게가 있는 동네). */
  merchantOfferNew: (areaId?: string) =>
    `/merchant/offers/new${areaId ? `?area=${encodeURIComponent(areaId)}` : ''}`,
  founder: '/founder',
  /** 입지 찾기. categoryId 가 있으면 ?category= 로 선택한 업종을 유지한다. */
  founderExplore: (categoryId?: string) =>
    `/founder${categoryId ? `?category=${encodeURIComponent(categoryId)}` : ''}`,
  /** 리포트는 업종별이라 categoryId 가 있으면 ?category= 로 전달한다. */
  founderAreaReport: (areaId: string, categoryId?: string) =>
    `/founder/areas/${encodeURIComponent(areaId)}/report` +
    (categoryId ? `?category=${encodeURIComponent(categoryId)}` : ''),
} as const;
