import { useId, type ReactNode } from 'react';
import { Button } from './Button';
import { Modal } from './Modal';
import styles from './ConfirmDialog.module.css';

interface ConfirmDialogProps {
  title: string;
  /** 본문. 제목 아래에 가운데 정렬로 보인다. */
  children: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  /** 확인 동작을 처리하는 중. 취소·닫기를 막고 확인 버튼에 처리 중을 표시한다. */
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * 가운데에 뜨는 확인창(모달). 뒤 화면은 어둡게 덮인다.
 * 포커스·Escape·배경 클릭·Tab 순환은 Modal 이 맡는다. busy 중에는 닫지 않는다.
 */
export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  cancelLabel,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const bodyId = useId();

  return (
    <Modal title={title} describedBy={bodyId} busy={busy} onClose={onCancel}>
      <p id={bodyId} className={styles.body}>
        {children}
      </p>
      <div className={styles.actions}>
        <Button variant="neutral" size="medium" disabled={busy} onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button variant="highlight" size="medium" loading={busy} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
