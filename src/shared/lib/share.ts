export type ShareResult = 'shared' | 'copied' | 'cancelled' | 'failed';

interface ShareContent {
  /** 공유 문구. 서비스 이름은 넣지 않는다(미확정). */
  text: string;
  url: string;
}

/**
 * 링크 공유: Web Share API 로 공유하고, 지원하지 않거나 쓸 수 없으면 링크를 클립보드에 복사한다.
 * - 사용자가 공유를 취소하면 'cancelled'(아무 안내도 하지 않는다).
 * - 복사까지 실패하면 'failed'.
 */
export async function shareLink({ text, url }: ShareContent): Promise<ShareResult> {
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ text, url });
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
      // 그 밖의 실패(권한 등)는 복사로 대신한다.
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return 'copied';
  } catch {
    return 'failed';
  }
}
