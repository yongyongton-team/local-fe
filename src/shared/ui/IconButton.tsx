import type { ComponentProps, ReactNode } from 'react';
import styles from './IconButton.module.css';

interface IconButtonProps extends Omit<ComponentProps<'button'>, 'aria-label' | 'children'> {
  /** 접근 가능한 이름. 아이콘만 있는 버튼이므로 필수다. */
  label: string;
  /** 장식용 아이콘. 이름은 label 이 전달하므로 아이콘은 aria-hidden 이어야 한다. */
  icon: ReactNode;
}

/** 아이콘만 있는 버튼. 터치 영역 44px 를 확보한다. */
export function IconButton({ label, icon, type = 'button', ...props }: IconButtonProps) {
  return (
    <button type={type} aria-label={label} className={styles.button} {...props}>
      {icon}
    </button>
  );
}
