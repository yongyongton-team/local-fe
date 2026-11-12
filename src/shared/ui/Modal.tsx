import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import styles from './Modal.module.css';

interface ModalProps {
  /** 대화상자의 제목(h2). 열릴 때 이 제목에 포커스가 간다. */
  title: ReactNode;
  /** 본문 요소의 id. 있으면 aria-describedby 로 연결한다. */
  describedBy?: string;
  /** 처리 중. 닫기(Escape·배경 클릭)를 막는다. */
  busy?: boolean;
  /** Escape 나 뒤 배경 클릭으로 닫을 때 부른다(busy 중에는 부르지 않는다). */
  onClose: () => void;
  /**
   * 모양. confirm 은 가운데 정렬의 확인창(ConfirmDialog), form 은 입력이 있는 왼쪽 정렬의 짧은 창이다.
   */
  size?: 'confirm' | 'form';
  children: ReactNode;
}

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * 대화상자 안에서 Tab 으로 닿는 요소. 같은 이름의 라디오 묶음은 브라우저가 한 곳(고른 것, 없으면 첫 번째)만 Tab 정지점으로 쓰므로
 * 나머지는 뺀다. 포함하면 묶음의 첫 라디오에서 Tab 을 눌렀을 때 순환 끝을 잘못 알아 대화상자 밖으로 나간다.
 */
function tabStops(dialog: HTMLElement): HTMLElement[] {
  const all = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)];
  const isRadio = (el: HTMLElement): el is HTMLInputElement =>
    el instanceof HTMLInputElement && el.type === 'radio' && el.name !== '';
  return all.filter((el) => {
    if (!isRadio(el)) return true;
    const group = all.filter(
      (other): other is HTMLInputElement => isRadio(other) && other.name === el.name,
    );
    return el === (group.find((radio) => radio.checked) ?? group[0]);
  });
}

/**
 * 가운데에 뜨는 모달 틀. 뒤 화면은 어둡게 덮인다. ConfirmDialog 와 간편 요청 창이 함께 쓴다.
 * - role="dialog", aria-modal. 열릴 때 제목에 포커스가 가고, 닫히면 열기 전 포커스 위치로 돌아간다.
 * - Escape 와 뒤 배경 클릭으로 닫는다(onClose). busy 중에는 닫지 않는다.
 * - Tab 은 대화상자 안에서만 돈다.
 */
export function Modal({
  title,
  describedBy,
  busy = false,
  onClose,
  size = 'confirm',
  children,
}: ModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const pressedOnBackdrop = useRef(false);
  // 키보드 핸들러는 마운트 때 한 번만 달고, 최신 값은 ref 로 읽는다.
  const latest = useRef({ busy, onClose });
  useEffect(() => {
    latest.current = { busy, onClose };
  });

  useEffect(() => {
    const previous = document.activeElement;
    titleRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (!latest.current.busy) latest.current.onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const dialog = dialogRef.current;
      if (!dialog) return;
      const items = tabStops(dialog);
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
        // 대화상자 안에서 누르기 시작해 배경에서 놓은 경우는 닫지 않는다.
        if (event.target === event.currentTarget && pressedOnBackdrop.current && !busy) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={describedBy}
        data-size={size}
        className={styles.dialog}
      >
        <h2 ref={titleRef} id={titleId} tabIndex={-1} className={styles.title}>
          {title}
        </h2>
        {children}
      </div>
    </div>,
    document.body,
  );
}
