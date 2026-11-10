import type { ReactNode } from 'react';
import { CheckIcon } from './icons';
import styles from './ChoiceChip.module.css';

interface BaseProps {
  children: ReactNode;
  selected: boolean;
  disabled?: boolean;
  /** 시각적 높이. default 26px, large 34px. 눌리는 영역은 두 경우 모두 44px 이상이다. */
  size?: 'default' | 'large';
}

/** 여러 선택지 중 하나만 고르는 칩. 네이티브 radio 를 쓰며 같은 name 끼리 한 그룹이다. */
interface RadioChipProps extends BaseProps {
  mode: 'radio';
  name: string;
  value: string;
  onSelect: (value: string) => void;
}

/** 켜고 끄는 칩(필터 토글 등). aria-pressed 를 가진 button 이다. */
interface ToggleChipProps extends BaseProps {
  mode: 'toggle';
  onToggle: (selected: boolean) => void;
}

export type ChoiceChipProps = RadioChipProps | ToggleChipProps;

/**
 * 선택 칩. 시각적 높이(--chip-height)와 터치 영역(44px)을 분리했다.
 * 선택 상태는 색상 외에 체크 아이콘, 테두리, 굵기, aria 속성(radio checked / aria-pressed)으로 전달한다.
 * 모든 칩을 tab 역할로 쓰지 않는다. tab 은 패널 전환 용도에만 쓴다.
 */
export function ChoiceChip(props: ChoiceChipProps) {
  const { children, selected, disabled, size = 'default' } = props;
  const visual = (
    <span
      className={[
        styles.chip,
        size === 'large' ? styles.large : '',
        selected ? styles.selected : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {selected && <CheckIcon />}
      {children}
    </span>
  );

  if (props.mode === 'radio') {
    return (
      <label className={`${styles.touch} ${disabled ? styles.disabled : ''}`}>
        <input
          type="radio"
          className={`visually-hidden ${styles.input}`}
          name={props.name}
          value={props.value}
          checked={selected}
          disabled={disabled}
          onChange={() => props.onSelect(props.value)}
        />
        {visual}
      </label>
    );
  }

  return (
    <button
      type="button"
      className={styles.touch}
      aria-pressed={selected}
      disabled={disabled}
      onClick={() => props.onToggle(!selected)}
    >
      {visual}
    </button>
  );
}
