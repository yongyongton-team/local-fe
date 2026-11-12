/*
 * 지도 영역 문구. 시안에 없는 임시 문구다.
 * 서버 데이터를 쓰는 모드(API)에서는 "예시"나 "연동 예정"처럼 mock 임을 알리는 말을 쓰지 않는다.
 */
export const MAP_COPY = {
  // TODO(문구 확정 후 교체)
  /** API 모드: 지도 스크립트를 불러오는 중 */
  loading: '지도를 불러오는 중이에요',
  // TODO(문구 확정 후 교체)
  /** 지도 스크립트를 불러오지 못했거나 인증에 실패했을 때(API 모드는 키가 없을 때와 지도를 그릴 수 없을 때도 같은 문구) */
  failed: '지도를 불러오지 못했어요',
  /**
   * 지도 영역의 접근 가능한 이름. mock 모드에서만 "(예시)" 를 붙인다.
   * remote 는 서비스의 remote 값(서버 데이터이면 true)이다.
   */
  regionLabel: (name: string, remote: boolean) => (remote ? name : `${name}(예시)`),
} as const;
