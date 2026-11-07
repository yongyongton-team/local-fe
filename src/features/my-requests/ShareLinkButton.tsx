import { useRef, useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { shareLink } from './share';
import styles from './ShareLinkButton.module.css';

type Status = 'idle' | 'copied' | 'failed';

/**
 * 이웃에게 알리기(링크 공유). 동작이 디자인에서 확인되지 않아 임시로 구현했다.
 * Web Share API → 클립보드 복사 순으로 시도하고, 공유를 취소하면 아무 문구도 띄우지 않는다.
 */
export function ShareLinkButton({ text }: { text: string }) {
  const [status, setStatus] = useState<Status>('idle');
  const busy = useRef(false);

  async function handleClick() {
    if (busy.current) return;
    busy.current = true;
    setStatus('idle');
    try {
      const result = await shareLink({ text, url: `${window.location.origin}/` });
      if (result === 'copied') setStatus('copied');
      if (result === 'failed') setStatus('failed');
    } finally {
      busy.current = false;
    }
  }

  return (
    <div className={styles.wrap}>
      <Button variant="highlight" fullWidth onClick={handleClick}>
        이웃에게 알리기 (링크 공유)
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
