import { NavLink } from 'react-router';
import styles from './BottomNav.module.css';

interface BottomNavProps {
  /** 내비게이션의 접근 가능한 이름 */
  label: string;
  items: readonly { to: string; label: string; end?: boolean }[];
}

/**
 * 하단 고정 내비게이션. 뷰포트 하단에 붙고, 넓은 화면에서는 모바일 영역 폭에 맞춘다.
 * 현재 탭은 aria-current 와 밑줄·굵기로 표시한다(색상만으로 구분하지 않음).
 */
export function BottomNav({ label, items }: BottomNavProps) {
  return (
    <nav aria-label={label} className={styles.nav}>
      <ul className={styles.list}>
        {items.map((item) => (
          <li key={item.to} className={styles.item}>
            <NavLink
              to={item.to}
              end={item.end}
              className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}
            >
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
