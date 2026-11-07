import { useId } from 'react';
import { ChoiceChip } from '@/shared/ui/ChoiceChip';
import styles from './ChipFieldset.module.css';

interface Option<T extends string> {
  value: T;
  label: string;
}

interface BaseProps {
  /** 그룹 이름(fieldset 의 legend) */
  legend: string;
  /** true 이면 legend 를 화면에서 숨기고 보조 기술에만 전달한다. */
  legendHidden?: boolean;
  size?: 'default' | 'large';
}

interface RadioProps<T extends string> extends BaseProps {
  mode: 'radio';
  options: readonly Option<T>[];
  /** 아직 고르지 않았으면 null */
  value: T | null;
  onChange: (value: T) => void;
}

interface ToggleProps<T extends string> extends BaseProps {
  mode: 'toggle';
  options: readonly Option<T>[];
  values: readonly T[];
  onChange: (values: T[]) => void;
}

/**
 * 선택 칩 묶음. fieldset + legend 로 그룹 이름을 전달한다.
 * radio: 하나만 선택(네이티브 라디오, 방향키 이동), toggle: 여러 개 선택(aria-pressed 버튼).
 */
export function ChipFieldset<T extends string>(props: RadioProps<T> | ToggleProps<T>) {
  const name = useId();
  const { legend, legendHidden = false, size = 'default', options } = props;

  return (
    <fieldset className={styles.fieldset}>
      <legend className={legendHidden ? 'visually-hidden' : styles.legend}>{legend}</legend>
      <div className={styles.chips}>
        {options.map((option) =>
          props.mode === 'radio' ? (
            <ChoiceChip
              key={option.value}
              mode="radio"
              size={size}
              name={name}
              value={option.value}
              selected={props.value === option.value}
              onSelect={() => props.onChange(option.value)}
            >
              {option.label}
            </ChoiceChip>
          ) : (
            <ChoiceChip
              key={option.value}
              mode="toggle"
              size={size}
              selected={props.values.includes(option.value)}
              onToggle={(selected) =>
                props.onChange(
                  selected
                    ? [...props.values, option.value]
                    : props.values.filter((value) => value !== option.value),
                )
              }
            >
              {option.label}
            </ChoiceChip>
          ),
        )}
      </div>
    </fieldset>
  );
}
