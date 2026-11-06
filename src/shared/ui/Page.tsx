import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { ArrowLeftIcon } from './icons';
import { Text } from './Text';
import styles from './Page.module.css';

interface PageProps {
  title: string;
  /** 지정하면 제목 앞에 뒤로 가기 링크를 둔다. */
  backTo?: string;
  children?: ReactNode;
}

/** 페이지 제목(h1)과 본문 영역의 공통 골격. */
export function Page({ title, backTo, children }: PageProps) {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        {backTo && (
          <Link to={backTo} className={styles.back} aria-label="뒤로 가기">
            <ArrowLeftIcon />
          </Link>
        )}
        <Text as="h1" variant="title">
          {title}
        </Text>
      </header>
      {children}
    </div>
  );
}
