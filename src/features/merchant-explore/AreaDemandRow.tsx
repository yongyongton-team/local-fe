import { CardLink } from '@/shared/ui/Card';
import { ChevronRightIcon } from '@/shared/ui/icons';
import type { AreaDemand } from '@/types/domain';
import { describeAreaRow } from './areaRows';
import styles from './AreaDemandRow.module.css';

/**
 * 동네 한 줄. 행 전체가 하나의 링크다(내부에 버튼·링크를 넣지 않는다).
 * 링크 이름은 한 문장으로 읽히게 하고, 오른쪽 화살표는 장식이라 숨긴다.
 */
export function AreaDemandRow({ area, to }: { area: AreaDemand; to: string }) {
  const text = describeAreaRow(area);

  return (
    <CardLink to={to} tone="accent" className={styles.row} aria-label={text.accessibleName}>
      <span className={styles.text}>
        <span className={styles.title}>{text.title}</span>
        <span className={styles.detail}>{text.detail}</span>
      </span>
      <span className={styles.chevron} aria-hidden="true">
        <ChevronRightIcon />
      </span>
    </CardLink>
  );
}
