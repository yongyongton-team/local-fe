/*
 * 입력 길이·범위 제한. 서버 명세(Swagger)의 제약값이며 maxLength 와 검증(붙여넣기·직접 호출 경로)이 같은 상수를 쓴다.
 * 서버가 값을 바꾸면 이 파일만 고친다.
 */

/** PUT /me/shop 의 shopName 최대 글자 수 */
export const SHOP_NAME_MAX = 50;

/** POST /offers 의 title 최대 글자 수 */
export const OFFER_TITLE_MAX = 50;
/** POST /offers 의 description 최대 글자 수 */
export const OFFER_DESCRIPTION_MAX = 500;
/** POST /offers 의 pickupPlace 최대 글자 수 */
export const OFFER_PICKUP_PLACE_MAX = 100;
/** POST /offers 의 minOrders 범위 */
export const OFFER_MIN_ORDERS_MIN = 1;
export const OFFER_MIN_ORDERS_MAX = 100;
/** POST /offers 의 price 는 int32 이다(최솟값 0 은 명세, 화면은 1원 이상을 요구한다). */
export const OFFER_PRICE_MAX = 2_147_483_647;
