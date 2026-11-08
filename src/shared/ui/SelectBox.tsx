import type { ComponentProps } from 'react';
import { ChevronDownIcon } from './icons';
import styles from './SelectBox.module.css';

/**
 * 네이티브 select + 장식용 chevron. 키보드·스크린리더 조작은 브라우저 select 가 맡는다.
 * 보이는 label 은 이 컴포넌트 밖에서 htmlFor/id 로 연결한다. 글자 크기는 16px 이상(iOS 확대 방지).
 * 기본 모양은 첫 화면의 동네 선택이고, 배경·테두리·높이·안쪽 여백은 부모에서 아래 CSS 변수로 바꾼다.
 *   --select-bg, --select-border, --select-min-height, --select-pad-left, --select-chevron-right, --select-font-weight
 */
export function SelectBox({ children, ...props }: ComponentProps<'select'>) {
  return (
    <div className={styles.wrap}>
      <select className={styles.select} {...props}>
        {children}
      </select>
      <span className={styles.chevron} aria-hidden="true">
        <ChevronDownIcon />
      </span>
    </div>
  );
}
