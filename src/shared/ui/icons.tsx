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

export function PeopleIcon() {
  return (
    <svg width="33" height="21" viewBox="0 0 33 21" {...svgBase}>
      <g fill="currentColor">
        <circle cx="8" cy="6" r="4" />
        <path d="M0.5 19c0-4 3.4-6.5 7.5-6.5s7.5 2.5 7.5 6.5z" />
        <circle cx="19" cy="5.5" r="4.5" />
        <path d="M10.5 19.5c0-4.2 3.8-7 8.5-7s8.5 2.8 8.5 7z" />
      </g>
      <path d="M27.5 3a3.5 3.5 0 0 1 0 5M30 1.5a6 6 0 0 1 0 8" {...ink} strokeWidth="1.5" />
    </svg>
  );
}

/** 있는 가게 위치 핀 */
export function PinIcon() {
  return (
    <svg width="17" height="21" viewBox="0 0 17 21" {...svgBase}>
      <circle cx="8.5" cy="7" r="6.5" fill="currentColor" />
      <circle cx="8.5" cy="7" r="2.2" style={{ fill: 'var(--color-surface)' }} />
      <path d="M8.5 13.5v6.5" {...ink} strokeWidth="1.8" />
    </svg>
  );
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
