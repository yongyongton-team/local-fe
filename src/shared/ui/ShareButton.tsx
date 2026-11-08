import { useRef, useState } from 'react';
import { shareLink } from '@/shared/lib/share';
import { Button } from './Button';
import styles from './ShareButton.module.css';

type Status = 'idle' | 'copied' | 'failed';

interface ShareButtonProps {
  /** 버튼 글자 */
  label: string;
  /** 공유 문구. 서비스 이름은 넣지 않는다(미확정). */
  text: string;
  /** 공유할 링크 */
  url: string;
}

/**
 * 링크 공유 버튼(임시 구현: 동작이 디자인에서 확인되지 않았다).
 * Web Share API → 클립보드 복사 순으로 시도하고, 공유를 취소하면 아무 문구도 띄우지 않는다.
 */
export function ShareButton({ label, text, url }: ShareButtonProps) {
  const [status, setStatus] = useState<Status>('idle');
  const busy = useRef(false);

  async function handleClick() {
    if (busy.current) return;
    busy.current = true;
    setStatus('idle');
    try {
      const result = await shareLink({ text, url });
      if (result === 'copied') setStatus('copied');
      if (result === 'failed') setStatus('failed');
    } finally {
      busy.current = false;
    }
  }

  return (
    <div className={styles.wrap}>
      <Button variant="highlight" fullWidth onClick={handleClick}>
        {label}
      </Button>
      {/* 복사했음을 보조 기술에 알린다. 비어 있어도 항상 렌더링해 둔다. */}
      <p aria-live="polite" className={styles.status}>
        {status === 'copied' ? '링크를 복사했어요' : ''}
      </p>
      {status === 'failed' && (
        <p role="alert" className={`${styles.status} ${styles.error}`}>
          공유하지 못했어요. 잠시 후 다시 시도해 주세요.
        </p>
      )}
    </div>
  );
}
