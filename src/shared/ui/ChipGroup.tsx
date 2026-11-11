import { useId } from 'react';
import { ChoiceChip } from './ChoiceChip';
import styles from './ChipGroup.module.css';

interface ChipGroupProps<T extends string> {
  /** 그룹의 접근 가능한 이름 (예: "지도 필터") */
  label: string;
  options: readonly { value: T; label: string }[];
  /** 선택된 값. 아무것도 고르지 않은 상태는 null */
  value: T | null;
  onChange: (value: T) => void;
  /** 선택된 칩의 체크 아이콘. 기본 true */
  showCheck?: boolean;
  /** 칩의 시각 높이. default 26px, large 34px */
  size?: 'default' | 'large';
}

/** 하나만 고르는 칩 묶음. radiogroup 의미로 전달되어 방향키로 이동할 수 있다. */
export function ChipGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  showCheck,
  size,
}: ChipGroupProps<T>) {
  const name = useId();

  return (
    <div role="radiogroup" aria-label={label} className={styles.group}>
      {options.map((option) => (
        <ChoiceChip
          key={option.value}
          mode="radio"
          name={name}
          value={option.value}
          selected={option.value === value}
          showCheck={showCheck}
          size={size}
          onSelect={() => onChange(option.value)}
        >
          {option.label}
        </ChoiceChip>
      ))}
    </div>
  );
}
