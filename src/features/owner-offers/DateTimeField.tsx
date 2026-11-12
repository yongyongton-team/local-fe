import { useId, type ChangeEvent } from 'react';
import { ChevronDownIcon } from '@/shared/ui/icons';
import styles from './OfferForm.module.css';

interface DateTimeFieldProps {
  label: string;
  /** datetime-local 값(KST). 비면 아직 고르지 않았다. */
  value: string;
  /** 값을 사람이 읽는 모양으로 바꾼다. 예: 11/15(토) 오전 10:00 */
  display: (value: string) => string;
  placeholder: string;
  onChange: (value: string) => void;
  /** 빨간 테두리로 오류를 보여주고, errorId 가 가리키는 문구와 연결한다. */
  invalid?: boolean;
  errorId?: string;
}

/**
 * 날짜·시간 고르기. 시안처럼 "11/15(토) 오전 10:00 ▾" 모양의 상자 위에 투명한 <input type="datetime-local"> 을 겹쳐 둔다.
 * 누르면 브라우저의 날짜·시간 선택기가 열린다.
 * TODO(디자인 확정 후 교체): 시안에 선택 UI 가 없어 임시로 이렇게 구현했다.
 */
export function DateTimeField({
  label,
  value,
  display,
  placeholder,
  onChange,
  invalid = false,
  errorId,
}: DateTimeFieldProps) {
  const id = useId();

  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <div className={`${styles.box} ${styles.dateBox}`} data-invalid={invalid || undefined}>
        <span className={value === '' ? styles.placeholder : styles.dateText} aria-hidden="true">
          {value === '' ? placeholder : display(value)}
        </span>
        <span className={styles.chevron} aria-hidden="true">
          <ChevronDownIcon />
        </span>
        <input
          id={id}
          type="datetime-local"
          className={styles.dateInput}
          value={value}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? errorId : undefined}
          onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
          onClick={(event) => {
            // 데스크톱 브라우저는 입력 칸의 아이콘을 눌러야 열리므로 상자 어디를 눌러도 열리게 한다.
            try {
              event.currentTarget.showPicker();
            } catch {
              // 지원하지 않거나 사용자 동작이 아니면 브라우저 기본 동작에 맡긴다.
            }
          }}
        />
      </div>
    </div>
  );
}
