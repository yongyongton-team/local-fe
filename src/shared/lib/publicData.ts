/**
 * 창업자 순위의 공공데이터 판정(verdict) 값. 서버(GET /founder/rankings 의 publicData.verdict)가 주는 문자열이다.
 * 서버가 새 값을 추가해도 깨지지 않도록 화면은 NOT_JUDGED 만 따로 다루고 나머지는 서버 문구(verdictLabel)를 그대로 보여준다.
 */
export const VERDICT_NOT_JUDGED = 'NOT_JUDGED';

/** 지금까지 알려진 판정 값(문서용·테스트용). 이 밖의 값도 올 수 있다. */
export const KNOWN_VERDICTS = [
  'SHORT',
  'SOME_NEARBY',
  'NEXT_DONG',
  'NOT_SHORT',
  VERDICT_NOT_JUDGED,
] as const;
