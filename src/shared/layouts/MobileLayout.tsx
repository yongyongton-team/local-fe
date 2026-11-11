import type { ReactNode } from 'react';
import styles from './MobileLayout.module.css';

interface MobileLayoutProps {
  children: ReactNode;
  /** 선택적인 상단 헤더 영역 */
  header?: ReactNode;
  /** 선택적인 하단 내비게이션. 고정 위치(fixed)여도 본문을 가리지 않도록 본문 하단 여백이 늘어난다. */
  bottomNav?: ReactNode;
  /**
   * 선택적인 우측 상단 요소. 화면의 로고 줄(로고 높이 43px)과 같은 높이의 오른쪽 끝에 놓인다.
   * 화면(페이지)이 공통 상단 여백(--space-2)에서 시작해 로고를 맨 위에 그린다는 전제다.
   */
  corner?: ReactNode;
}

/**
 * 모바일 공통 콘텐츠 영역.
 * - 최대 너비(--layout-max-width) 안에서 중앙 정렬. 화면 높이는 고정하지 않는다.
 * - iOS safe-area 와 하단 내비게이션 높이만큼 본문 여백을 확보한다.
 * 라우트 단위로 쓰려면 RootLayout 을 사용한다.
 */
export function MobileLayout({ children, header, bottomNav, corner }: MobileLayoutProps) {
  return (
    <div className={styles.shell}>
      {corner && <div className={styles.corner}>{corner}</div>}
      {header && <header className={styles.header}>{header}</header>}
      <main className={`${styles.content} ${bottomNav ? styles.withBottomNav : ''}`}>
        {children}
      </main>
      {bottomNav}
    </div>
  );
}
