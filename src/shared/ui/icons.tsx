/** 꼭 필요한 최소 인라인 SVG 아이콘. 장식용이므로 스크린 리더에는 숨긴다. */

export function CheckIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M3 8.5l3.2 3L13 4.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ArrowLeftIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M15 5l-7 7 7 7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 선택 표시용 체크 원. filled 이면 채워진 원 + 흰 체크, 아니면 외곽선 원 + 체크. 색은 currentColor. */
export function CheckCircleIcon({ filled = false }: { filled?: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      {filled ? (
        <circle cx="12" cy="12" r="11" fill="currentColor" />
      ) : (
        <circle cx="12" cy="12" r="10.25" stroke="currentColor" strokeWidth="1.5" />
      )}
      <path
        d="M7.5 12.5l3 3 6-6.5"
        stroke={filled ? 'var(--color-surface)' : 'currentColor'}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ChevronDownIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M5.5 9l6.5 6.5L18.5 9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/*
 * 주민 탐색 화면 아이콘. Figma 의 SF Symbols(magnifyingglass, person.2.wave.2.fill, mappin, map,
 * link.badge.plus, person.badge.shield.checkmark.fill, person.crop.circle.badge.* )는 Apple 플랫폼 밖에서
 * 쓸 수 없어 글리프나 경로를 복사하지 않고 단순한 형태로 직접 그렸다. 최종 아이콘 에셋이 정해지면 이 파일에서 교체한다.
 * 모두 장식용이므로 보조 기술에는 숨긴다(이름은 버튼·링크가 전달).
 */

const svgBase = { fill: 'none', 'aria-hidden': true, focusable: 'false' } as const;
const ink = { stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

export function SearchIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" {...svgBase}>
      <circle cx="10.5" cy="10.5" r="6.5" {...ink} strokeWidth="2" />
      <path d="M15.5 15.5 21 21" {...ink} strokeWidth="2" />
    </svg>
  );
}

/*
 * 있는 가게 위치 핀의 도형. React 컴포넌트(PinIcon)와 네이버 지도 마커용 DOM(buildPinSvg)이 같은 값을 쓴다.
 * (지도 마커는 React 밖의 HTML 아이콘이라 react-dom/server 를 번들에 넣지 않으려고 DOM 으로 직접 만든다.)
 */
/** 핀 그림의 크기(px). 지도 위에서 핀 중심을 좌표에 맞출 때 쓴다. */
export const PIN_SIZE = { width: 17, height: 21 } as const;

const PIN = {
  width: PIN_SIZE.width,
  height: PIN_SIZE.height,
  headFill: 'currentColor',
  holeFill: 'var(--color-surface)',
  stem: 'M8.5 13.5v6.5',
} as const;

/** 있는 가게 위치 핀 */
export function PinIcon() {
  return (
    <svg width={PIN.width} height={PIN.height} viewBox="0 0 17 21" {...svgBase}>
      <circle cx="8.5" cy="7" r="6.5" fill={PIN.headFill} />
      <circle cx="8.5" cy="7" r="2.2" style={{ fill: PIN.holeFill }} />
      <path d={PIN.stem} {...ink} strokeWidth="1.8" />
    </svg>
  );
}

/** PinIcon 과 같은 모양의 SVG DOM. React 밖(네이버 지도 HTML 마커)에서 쓴다. 장식이라 보조 기술에는 숨긴다. */
export function buildPinSvg(): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('width', String(PIN.width));
  svg.setAttribute('height', String(PIN.height));
  svg.setAttribute('viewBox', '0 0 17 21');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');

  const head = document.createElementNS(ns, 'circle');
  head.setAttribute('cx', '8.5');
  head.setAttribute('cy', '7');
  head.setAttribute('r', '6.5');
  head.setAttribute('fill', PIN.headFill);
  const hole = document.createElementNS(ns, 'circle');
  hole.setAttribute('cx', '8.5');
  hole.setAttribute('cy', '7');
  hole.setAttribute('r', '2.2');
  hole.style.fill = PIN.holeFill;
  const stem = document.createElementNS(ns, 'path');
  stem.setAttribute('d', PIN.stem);
  stem.setAttribute('stroke', 'currentColor');
  stem.setAttribute('stroke-linecap', 'round');
  stem.setAttribute('stroke-linejoin', 'round');
  stem.setAttribute('stroke-width', '1.8');
  svg.append(head, hole, stem);
  return svg;
}

/** 하단 내비 아이콘. active 이면 선이 굵어진다(색 외의 선택 단서). */
interface NavIconProps {
  active?: boolean;
}

const navStroke = (active?: boolean) => (active ? 2.4 : 1.75);

export function MapIcon({ active }: NavIconProps) {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" {...svgBase}>
      <path
        d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14"
        {...ink}
        strokeWidth={navStroke(active)}
      />
    </svg>
  );
}

export function LinkPlusIcon({ active }: NavIconProps) {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" {...svgBase}>
      <path
        d="M9.5 14.5a3.5 3.5 0 0 0 5 0l2.5-2.5a3.5 3.5 0 0 0-5-5L11 8M14.5 9.5a3.5 3.5 0 0 0-5 0L7 12a3.5 3.5 0 0 0 5 5l1-1M19 15.5v6M16 18.5h6"
        {...ink}
        strokeWidth={navStroke(active)}
      />
    </svg>
  );
}

export function PersonShieldIcon({ active }: NavIconProps) {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" {...svgBase}>
      <g {...ink} strokeWidth={navStroke(active)}>
        <circle cx="10" cy="7.5" r="3.5" />
        <path d="M3.5 20c0-3.6 2.9-6 6.5-6 1.2 0 2.3.3 3.2.7" />
        <path d="M18.5 13.5l3.5 1.4v3c0 2.2-1.5 3.6-3.5 4.4-2-.8-3.5-2.2-3.5-4.4v-3z" />
        <path d="M16.8 18l1.4 1.4 2.4-2.6" />
      </g>
    </svg>
  );
}

/** 요청 카드 우측 아이콘: 사람 + 배지. 라임 카드 위에서 배지가 분리되어 보이도록 라임 테두리를 둔다. */
function PersonCircle({ filled, badge }: { filled: boolean; badge: 'plus' | 'check' }) {
  const knockout = { fill: 'var(--color-accent)' };
  return (
    <svg width="22" height="21" viewBox="0 0 24 23" {...svgBase}>
      <circle
        cx="13"
        cy="11"
        r="9.5"
        {...ink}
        strokeWidth="1.5"
        fill={filled ? 'currentColor' : 'none'}
      />
      <circle cx="13" cy="9" r="3" style={filled ? knockout : { fill: 'currentColor' }} />
      <path
        d="M7 17.5c1.2-2.4 3.4-3.5 6-3.5s4.8 1.1 6 3.5"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
        style={{ stroke: filled ? 'var(--color-accent)' : 'currentColor' }}
      />
      <circle
        cx="6"
        cy="17.5"
        r="5"
        fill="currentColor"
        style={{ stroke: 'var(--color-accent)' }}
        strokeWidth="1.5"
      />
      <path
        d={badge === 'plus' ? 'M6 15.2v4.6M3.7 17.5h4.6' : 'M3.6 17.6l1.7 1.7 3.1-3.4'}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        style={{ stroke: 'var(--color-accent)' }}
      />
    </svg>
  );
}

/** "내가 요청하지 않음": + 배지 */
export function PersonCirclePlusIcon() {
  return <PersonCircle filled={false} badge="plus" />;
}

/** "내가 요청함": 채워진 사람 + 체크 배지 */
export function PersonCircleCheckIcon() {
  return <PersonCircle filled badge="check" />;
}

/** 목록 행 오른쪽의 화살표. SF Symbols(chevron.right)를 복사하지 않고 직접 그렸다. 장식이다. */
export function ChevronRightIcon() {
  return (
    <svg width="14" height="21" viewBox="0 0 14 21" {...svgBase}>
      <path d="M3.5 3.5l7 7-7 7" {...ink} strokeWidth="2" />
    </svg>
  );
}

/** 휴지통(삭제). SF Symbols(trash)를 복사하지 않고 직접 그렸다. 장식이다. */
export function TrashIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" {...svgBase}>
      <g {...ink} strokeWidth="1.6">
        <path d="M3.5 6.5h17M9 6.5V4.2c0-.4.3-.7.7-.7h4.6c.4 0 .7.3.7.7v2.3" />
        <path d="M5.8 6.5l.9 12.8c.1.9.8 1.7 1.8 1.7h7c1 0 1.7-.8 1.8-1.7l.9-12.8" />
        <path d="M10 10.5v6.5M14 10.5v6.5" />
      </g>
    </svg>
  );
}

/** 프로필 아바타: 라임색 원 안의 사람 실루엣. 장식이다(이름은 옆 글자가 전달한다). */
export function AvatarIcon() {
  return (
    <svg width="53" height="53" viewBox="0 0 53 53" {...svgBase}>
      <circle cx="26.5" cy="26.5" r="26.5" fill="var(--color-accent)" />
      <circle cx="26.5" cy="21" r="8.5" fill="var(--color-black)" />
      <path
        d="M9.5 46c1.6-8.2 8.4-13 17-13s15.4 4.8 17 13a26.5 26.5 0 0 1-34 0z"
        fill="var(--color-black)"
      />
    </svg>
  );
}

/**
 * 사장님·예비 창업자 화면 우측 상단(MyInfoLink)의 "내 정보" 아이콘(사람 + 방패 체크, 25×26).
 * 디자인 원본 SVG 의 path 를 그대로 쓰고 색만 currentColor 로 바꿨다. 이 아이콘은 우측 상단 전용이다
 * (주민 하단 내비 ④는 StoreSignIcon). 장식이다.
 */
export function MyPageIcon() {
  return (
    <svg width="25" height="26" viewBox="0 0 25 26" {...svgBase}>
      <path
        d="M9.86719 10.2188C9.03125 10.2188 8.25781 9.99219 7.54688 9.53906C6.83594 9.07812 6.26172 8.46094 5.82422 7.6875C5.39453 6.90625 5.17969 6.03125 5.17969 5.0625C5.17969 4.10938 5.39453 3.25 5.82422 2.48438C6.26172 1.71875 6.83594 1.11328 7.54688 0.667969C8.25781 0.222656 9.03125 0 9.86719 0C10.7031 0 11.4766 0.21875 12.1875 0.65625C12.8984 1.09375 13.4688 1.69531 13.8984 2.46094C14.3359 3.21875 14.5547 4.07812 14.5547 5.03906C14.5547 6.01562 14.3359 6.89453 13.8984 7.67578C13.4688 8.45703 12.8984 9.07812 12.1875 9.53906C11.4766 9.99219 10.7031 10.2188 9.86719 10.2188ZM2.00391 21.0703C1.37891 21.0703 0.886719 20.9297 0.527344 20.6484C0.175781 20.375 0 19.9961 0 19.5117C0 18.7539 0.226562 17.9609 0.679688 17.1328C1.14062 16.2969 1.79688 15.5156 2.64844 14.7891C3.50781 14.0547 4.54297 13.4609 5.75391 13.0078C6.97266 12.5469 8.34375 12.3164 9.86719 12.3164C10.7266 12.3164 11.5391 12.4023 12.3047 12.5742C13.0703 12.7383 13.7773 12.9609 14.4258 13.2422C14.0742 13.4375 13.7656 13.668 13.5 13.9336C13.2344 14.1914 13.0273 14.4922 12.8789 14.8359C12.7305 15.1797 12.6562 15.5742 12.6562 16.0195V20.2031C12.6562 20.4844 12.6758 20.7734 12.7148 21.0703H2.00391ZM14.6133 20.2383V16.0195C14.6133 15.6836 14.6836 15.4023 14.8242 15.1758C14.9727 14.9414 15.2188 14.75 15.5625 14.6016C15.7344 14.5312 15.9805 14.4375 16.3008 14.3203C16.6211 14.2031 16.9609 14.082 17.3203 13.957C17.6797 13.8242 18.0117 13.707 18.3164 13.6055C18.6289 13.4961 18.8555 13.4141 18.9961 13.3594C19.207 13.2734 19.418 13.2305 19.6289 13.2305C19.8477 13.2227 20.0547 13.25 20.25 13.3125C20.4141 13.375 20.6523 13.4648 20.9648 13.582C21.2852 13.6914 21.6289 13.8125 21.9961 13.9453C22.3633 14.0781 22.707 14.2031 23.0273 14.3203C23.3477 14.4375 23.5977 14.5312 23.7773 14.6016C24.1211 14.75 24.3633 14.9414 24.5039 15.1758C24.6523 15.4023 24.7266 15.6836 24.7266 16.0195V20.2383C24.7266 20.9883 24.5703 21.6133 24.2578 22.1133C23.9531 22.6133 23.4688 23.0898 22.8047 23.543C22.1406 24.0039 21.2773 24.5469 20.2148 25.1719C20.0273 25.2812 19.832 25.3281 19.6289 25.3125C19.4336 25.3047 19.2656 25.2578 19.125 25.1719C18.0625 24.5547 17.1992 24.0156 16.5352 23.5547C15.8711 23.0938 15.3828 22.6133 15.0703 22.1133C14.7656 21.6133 14.6133 20.9883 14.6133 20.2383ZM18.9727 22.4883C19.2461 22.4883 19.4492 22.3945 19.582 22.207L22.9922 17.4844C23.0469 17.4062 23.0859 17.3281 23.1094 17.25C23.1406 17.1719 23.1562 17.1016 23.1562 17.0391C23.1562 16.8281 23.082 16.6562 22.9336 16.5234C22.7852 16.3828 22.6133 16.3125 22.418 16.3125C22.1602 16.3125 21.9531 16.4219 21.7969 16.6406L18.9375 20.6016L17.4961 19.043C17.4336 18.9727 17.3555 18.9141 17.2617 18.8672C17.168 18.8203 17.0586 18.7969 16.9336 18.7969C16.7305 18.7969 16.5586 18.8672 16.418 19.0078C16.2773 19.1484 16.207 19.3242 16.207 19.5352C16.207 19.6133 16.2227 19.6992 16.2539 19.793C16.2852 19.8945 16.332 19.9844 16.3945 20.0625L18.3867 22.2305C18.457 22.3164 18.5469 22.3789 18.6562 22.418C18.7656 22.4648 18.8711 22.4883 18.9727 22.4883Z"
        fill="currentColor"
      />
    </svg>
  );
}

/**
 * 주민 하단 내비 ④ "내 정보"(가게 간판: 차양이 있는 상점). Figma 노드 45:451 의 네 번째 아이콘(45:458, SF Symbol "storefront")을
 * 내보낸 SVG(27×26)의 path 를 그대로 쓰고 색만 currentColor 로 바꿨다. 채워진 그림이라 활성 표시(굵은 선)는 따로 없고,
 * /me 에는 내비가 없어서 이 항목이 현재 항목이 될 일도 없다. 장식이다.
 */
export function StoreSignIcon() {
  return (
    <svg width="27" height="26" viewBox="0 0 27 26" {...svgBase}>
      <path
        d="M4.01953 14.1211C3.26953 14.1211 2.58984 13.9453 1.98047 13.5938C1.37891 13.2344 0.898438 12.7539 0.539062 12.1523C0.179688 11.543 0 10.8672 0 10.125V9.92578C0 9.48047 0.117188 9.05859 0.351562 8.66016L3.45703 3.35156V2.37891C3.45703 1.63672 3.67188 1.05469 4.10156 0.632812C4.53906 0.210938 5.13672 0 5.89453 0H21.0469C21.7969 0 22.3867 0.210938 22.8164 0.632812C23.2539 1.05469 23.4727 1.63672 23.4727 2.37891V3.35156L26.5781 8.66016C26.8125 9.05859 26.9297 9.48047 26.9297 9.92578V10.125C26.9297 10.8672 26.75 11.543 26.3906 12.1523C26.0391 12.7539 25.5586 13.2344 24.9492 13.5938C24.3398 13.9453 23.6602 14.1211 22.9102 14.1211C22.2617 14.1211 21.6641 13.9844 21.1172 13.7109C20.5703 13.4297 20.1211 13.0508 19.7695 12.5742C19.4102 13.0508 18.957 13.4297 18.4102 13.7109C17.8711 13.9844 17.2734 14.1211 16.6172 14.1211C15.9609 14.1211 15.3594 13.9805 14.8125 13.6992C14.2656 13.418 13.8164 13.043 13.4648 12.5742C13.1133 13.043 12.6641 13.418 12.1172 13.6992C11.5703 13.9805 10.9688 14.1211 10.3125 14.1211C9.66406 14.1211 9.06641 13.9844 8.51953 13.7109C7.97266 13.4297 7.52344 13.0508 7.17188 12.5742C6.8125 13.0508 6.35938 13.4297 5.8125 13.7109C5.27344 13.9844 4.67578 14.1211 4.01953 14.1211ZM5.22656 2.98828H21.7031V2.70703C21.7031 2.41016 21.6211 2.17969 21.457 2.01562C21.3008 1.85156 21.0781 1.76953 20.7891 1.76953H6.14062C5.85156 1.76953 5.625 1.85156 5.46094 2.01562C5.30469 2.17969 5.22656 2.41016 5.22656 2.70703V2.98828ZM2.02734 9.23438H24.8789L22.2656 4.75781H4.57031L2.02734 9.23438ZM1.75781 10.8867C1.89062 11.3555 2.14844 11.7383 2.53125 12.0352C2.92188 12.3242 3.41797 12.4688 4.01953 12.4688C4.62109 12.4688 5.11328 12.3242 5.49609 12.0352C5.88672 11.7383 6.14844 11.3555 6.28125 10.8867H1.75781ZM8.0625 10.8867C8.1875 11.3555 8.44141 11.7383 8.82422 12.0352C9.21484 12.3242 9.71094 12.4688 10.3125 12.4688C10.9141 12.4688 11.4102 12.3242 11.8008 12.0352C12.1914 11.7383 12.4492 11.3555 12.5742 10.8867H8.0625ZM14.3555 10.8867C14.4883 11.3555 14.7461 11.7383 15.1289 12.0352C15.5195 12.3242 16.0156 12.4688 16.6172 12.4688C17.2188 12.4688 17.7109 12.3242 18.0938 12.0352C18.4844 11.7383 18.7461 11.3555 18.8789 10.8867H14.3555ZM20.6602 10.8867C20.7852 11.3555 21.0391 11.7383 21.4219 12.0352C21.8125 12.3242 22.3086 12.4688 22.9102 12.4688C23.5117 12.4688 24.0078 12.3242 24.3984 12.0352C24.7891 11.7383 25.0469 11.3555 25.1719 10.8867H20.6602ZM4.65234 25.6875C3.81641 25.6875 3.16797 25.4609 2.70703 25.0078C2.24609 24.5547 2.01562 23.918 2.01562 23.0977V13.1836L3.90234 13.207V22.6172C3.90234 23 4 23.293 4.19531 23.4961C4.39844 23.6992 4.6875 23.8008 5.0625 23.8008H21.8789C22.2539 23.8008 22.5391 23.6992 22.7344 23.4961C22.9297 23.293 23.0273 23 23.0273 22.6172V13.2188L24.9141 13.1484V23.0977C24.9141 23.918 24.6836 24.5547 24.2227 25.0078C23.7617 25.4609 23.1133 25.6875 22.2773 25.6875H4.65234ZM5.76562 24.9141V17.2266C5.76562 16.9609 5.84766 16.7461 6.01172 16.582C6.18359 16.418 6.40234 16.3359 6.66797 16.3359H11.6367C11.9102 16.3359 12.125 16.418 12.2812 16.582C12.4453 16.7461 12.5273 16.9609 12.5273 17.2266V24.9141H5.76562ZM14.7305 16.6055C14.7305 16.332 14.8125 16.1172 14.9766 15.9609C15.1406 15.7969 15.3594 15.7148 15.6328 15.7148H20.3906C20.6562 15.7148 20.8672 15.7969 21.0234 15.9609C21.1875 16.1172 21.2695 16.332 21.2695 16.6055V19.9102C21.2695 20.1836 21.1875 20.4023 21.0234 20.5664C20.8672 20.7227 20.6562 20.8008 20.3906 20.8008H15.6328C15.3594 20.8008 15.1406 20.7227 14.9766 20.5664C14.8125 20.4023 14.7305 20.1836 14.7305 19.9102V16.6055Z"
        fill="currentColor"
      />
    </svg>
  );
}
