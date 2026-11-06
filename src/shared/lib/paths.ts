/** 화면 이동에 쓰는 경로. 라우트 패턴(app/routes.tsx)과 짝을 이룬다. */
export const paths = {
  home: '/',
  resident: '/resident',
  residentRequestNew: '/resident/requests/new',
  residentRequests: '/resident/requests',
  merchant: '/merchant',
  merchantArea: (areaId: string) => `/merchant/areas/${encodeURIComponent(areaId)}`,
  founder: '/founder',
  founderAreaReport: (areaId: string) => `/founder/areas/${encodeURIComponent(areaId)}/report`,
} as const;
