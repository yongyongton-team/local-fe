import type { ReactNode } from 'react';
import { LinkButton } from './Button';
import { Card } from './Card';
import { Text } from './Text';
import styles from './Notice.module.css';

interface NoticeProps {
  title: string;
  children?: ReactNode;
  action?: { to: string; label: string };
}

/** 안내·빈 상태·오류 메시지 카드. 선택적으로 이동 링크를 붙인다. */
export function Notice({ title, children, action }: NoticeProps) {
  return (
    <Card as="section">
      <div className={styles.body}>
        <Text as="h2" variant="title">
          {title}
        </Text>
        {children && <Text variant="caption">{children}</Text>}
        {action && (
          <LinkButton to={action.to} variant="highlight" size="small">
            {action.label}
          </LinkButton>
        )}
      </div>
    </Card>
  );
}
