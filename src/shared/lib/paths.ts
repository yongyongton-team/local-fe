/** 화면 이동에 쓰는 경로. 라우트 패턴(app/routes.tsx)과 짝을 이룬다. */
export const paths = {
  home: '/',
  resident: '/resident',
  residentRequestNew: '/resident/requests/new',
  residentRequests: '/resident/requests',
  merchant: '/merchant',
  merchantArea: (areaId: string) => `/merchant/areas/${encodeURIComponent(areaId)}`,
  founder: '/founder',
  /** 리포트는 업종별이라 categoryId 가 있으면 ?category= 로 전달한다. */
  founderAreaReport: (areaId: string, categoryId?: string) =>
    `/founder/areas/${encodeURIComponent(areaId)}/report` +
    (categoryId ? `?category=${encodeURIComponent(categoryId)}` : ''),
} as const;
