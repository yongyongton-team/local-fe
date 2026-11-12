import { CardLink } from './Card';
import { ChevronRightIcon } from './icons';
import styles from './ListRowLink.module.css';

interface ListRowLinkProps {
  to: string;
  /** 굵은 제목 */
  title: string;
  /** 작은 둘째 줄 */
  detail: string;
  /** 작은 셋째 줄(선택). 길면 줄바꿈된다. 없으면 그리지 않는다. */
  extra?: string;
  /** 링크의 접근 가능한 이름. 한 문장으로 읽힌다. */
  accessibleName: string;
}

/**
 * 목록의 한 줄: 라임 카드 전체가 하나의 링크(제목, 작은 둘째 줄, 오른쪽 화살표).
 * 내부에 버튼·링크를 넣지 않고, 오른쪽 화살표는 장식이라 보조 기술에서 숨긴다.
 */
export function ListRowLink({ to, title, detail, extra, accessibleName }: ListRowLinkProps) {
  return (
    <CardLink to={to} tone="accent" className={styles.row} aria-label={accessibleName}>
      <span className={styles.text}>
        <span className={styles.title}>{title}</span>
        <span className={styles.detail}>{detail}</span>
        {extra && <span className={styles.detail}>{extra}</span>}
      </span>
      <span className={styles.chevron} aria-hidden="true">
        <ChevronRightIcon />
      </span>
    </CardLink>
  );
}
