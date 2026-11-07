import type { ReactNode } from 'react';
import { NavLink } from 'react-router';
import styles from './BottomNav.module.css';

interface BottomNavItem {
  to: string;
  /** 접근 가능한 이름. icon 이 있으면 화면에는 보이지 않고 보조 기술에만 전달된다. */
  label: string;
  end?: boolean;
  /** 아이콘 내비게이션용. active 이면 선이 굵은 아이콘을 그린다. */
  icon?: (active: boolean) => ReactNode;
}

interface BottomNavProps {
  /** 내비게이션의 접근 가능한 이름 */
  label: string;
  items: readonly BottomNavItem[];
}

/**
 * 하단 고정 내비게이션. 뷰포트 하단에 떠 있고, 넓은 화면에서는 모바일 영역 폭에 맞춘다.
 * 현재 항목은 aria-current 로 전달하고, 글자 내비는 굵기·밑줄, 아이콘 내비는 굵은 선과 번짐 효과로
 * 표시한다(색상만으로 구분하지 않음).
 */
export function BottomNav({ label, items }: BottomNavProps) {
  const iconMode = items.some((item) => item.icon);

  return (
    <nav aria-label={label} className={styles.nav}>
      <ul className={`${styles.list} ${iconMode ? styles.iconList : ''}`}>
        {items.map((item) => (
          <li key={item.to} className={styles.item}>
            <NavLink
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                [
                  styles.link,
                  item.icon ? styles.iconLink : '',
                  isActive ? (item.icon ? styles.iconActive : styles.active) : '',
                ]
                  .filter(Boolean)
                  .join(' ')
              }
            >
              {({ isActive }) =>
                item.icon ? (
                  <>
                    {isActive && <span className={styles.glow} aria-hidden="true" />}
                    <span className={styles.iconWrap}>{item.icon(isActive)}</span>
                    <span className="visually-hidden">{item.label}</span>
                  </>
                ) : (
                  item.label
                )
              }
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
