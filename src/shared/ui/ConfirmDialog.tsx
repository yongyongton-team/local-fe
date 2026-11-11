import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './Button';
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

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * 가운데에 뜨는 확인창(모달). 뒤 화면은 어둡게 덮인다.
 * - role="dialog", aria-modal. 열릴 때 제목에 포커스가 가고, 닫히면 열기 전 포커스 위치로 돌아간다.
 * - Escape, 취소 버튼, 뒤 배경 클릭으로 닫는다(onCancel). busy 중에는 닫지 않는다.
 * - Tab 은 확인창 안에서만 돈다.
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
  const titleId = useId();
  const bodyId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const pressedOnBackdrop = useRef(false);
  // 키보드 핸들러는 마운트 때 한 번만 달고, 최신 값은 ref 로 읽는다.
  const latest = useRef({ busy, onCancel });
  useEffect(() => {
    latest.current = { busy, onCancel };
  });

  useEffect(() => {
    const previous = document.activeElement;
    titleRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (!latest.current.busy) latest.current.onCancel();
        return;
      }
      if (event.key !== 'Tab') return;

      const dialog = dialogRef.current;
      if (!dialog) return;
      const items = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)];
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) {
        event.preventDefault();
        return;
      }
      const active = document.activeElement;
      const inside = active instanceof Node && dialog.contains(active);
      if (!inside || (event.shiftKey && (active === first || active === titleRef.current))) {
        event.preventDefault();
        (event.shiftKey && inside ? last : first).focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, []);

  return createPortal(
    <div
      className={styles.backdrop}
      onMouseDown={(event) => {
        pressedOnBackdrop.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        // 확인창 안에서 누르기 시작해 배경에서 놓은 경우는 닫지 않는다.
        if (event.target === event.currentTarget && pressedOnBackdrop.current && !busy) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        className={styles.dialog}
      >
        <h2 ref={titleRef} id={titleId} tabIndex={-1} className={styles.title}>
          {title}
        </h2>
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
      </div>
    </div>,
    document.body,
  );
}
