import { useId } from 'react';
import { ChoiceChip } from './ChoiceChip';
import styles from './ChipGroup.module.css';

interface ChipGroupProps<T extends string> {
  /** 그룹의 접근 가능한 이름 (예: "지도 필터") */
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

/** 하나만 고르는 칩 묶음. radiogroup 의미로 전달되어 방향키로 이동할 수 있다. */
export function ChipGroup<T extends string>({
  label,
  options,
  value,
  onChange,
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
          onSelect={() => onChange(option.value)}
        >
          {option.label}
        </ChoiceChip>
      ))}
    </div>
  );
}
