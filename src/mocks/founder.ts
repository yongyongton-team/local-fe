import type { MapPosition } from '@/types/domain';

/*
 * 예비 창업자 입지 찾기 화면의 개발용 목 데이터. 실제 위치나 통계가 아니다.
 * "[임의]" 로 표시한 값은 디자인 예시에서 가져온 개발용 값이다.
 */

/** Figma 지도 카드(362×199)의 좌상단 px 좌표를 0~1 상대좌표로 바꾼다. 네이버 지도 연동 때 위경도로 교체한다. */
const at = (x: number, y: number): MapPosition => ({ x: x / 362, y: y / 199 });

/**
 * 동네의 지도 알약 위치(좌상단 기준). 위치는 동네에 속한 값이라 업종을 바꿔 순위가 달라져도 그대로다.
 * 값은 Figma 2:1903 에서 읽은 구성동·보정동·마북동 알약 위치다.
 */
export const mockFounderMapPositions: readonly { neighborhoodId: string; position: MapPosition }[] =
  [
    { neighborhoodId: 'guseong', position: at(135, 32) },
    { neighborhoodId: 'bojeong', position: at(24, 120) },
    { neighborhoodId: 'mabuk', position: at(236, 127) },
  ];
