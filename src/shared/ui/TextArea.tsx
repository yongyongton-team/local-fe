import { useId, type ComponentProps } from 'react';
import styles from './TextArea.module.css';

interface TextAreaProps extends Omit<ComponentProps<'textarea'>, 'id'> {
  /** 보이는 label. 필수 */
  label: string;
  /** 입력 방법 등 보조 설명 */
  description?: string;
  /** 있으면 오류 상태. 메시지는 입력 필드와 aria-describedby 로 연결된다. */
  error?: string;
  id?: string;
}

/**
 * label, 설명, 오류 메시지가 연결된 여러 줄 입력.
 * value / onChange 등 네이티브 textarea 속성을 그대로 지원한다. 글자 크기는 16px 이상(iOS 확대 방지).
 */
export function TextArea({ label, description, error, id, rows = 4, ...props }: TextAreaProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const descriptionId = `${fieldId}-description`;
  const errorId = `${fieldId}-error`;
  const describedBy = [description && descriptionId, error && errorId].filter(Boolean).join(' ');

  return (
    <div className={styles.field}>
      <label htmlFor={fieldId} className={styles.label}>
        {label}
      </label>
      {description && (
        <p id={descriptionId} className={styles.description}>
          {description}
        </p>
      )}
      <textarea
        id={fieldId}
        rows={rows}
        className={styles.textarea}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        {...props}
      />
      {error && (
        <p id={errorId} role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </div>
  );
}
