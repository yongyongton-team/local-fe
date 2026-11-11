import { useRef, useState } from 'react';
import { myRequestService } from '@/services';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { IconButton } from '@/shared/ui/IconButton';
import { TrashIcon } from '@/shared/ui/icons';
import { Text } from '@/shared/ui/Text';
import type { MyRequest } from '@/types/domain';
import { MyRequestCard } from './MyRequestCard';
import styles from './MyRequestList.module.css';

/** [임시] 일부 또는 전부 지우지 못했을 때의 문구. 서버 message 는 쓰지 않는다. */
export const DELETE_FAILED_TEXT = '일부 요청을 지우지 못했어요. 다시 시도해 주세요.';

/** [임시] 두 개 이상 고른 경우의 확인창 문구(디자인에는 하나만 고른 경우뿐이다). */
const MULTI_BODY = '지운 요청은 되돌릴 수 없어요.';

interface MyRequestListProps {
  items: readonly MyRequest[];
  /** 서버(또는 목)에서 지워진 요청의 id. 이미 지워진 요청(404)도 포함한다. */
  onRemoved: (ids: string[]) => void;
}

/**
 * 내 요청 목록과 삭제. 체크로 요청을 고르고(여러 개 가능) 휴지통을 누르면 확인창이 뜬다.
 * 지우는 동안에는 체크·휴지통·확인창 버튼을 막고, 요청은 각각 따로 보낸다(Promise.allSettled).
 * 지워진 요청만 목록에서 빠지고, 실패한 요청은 남고 선택도 유지된다.
 */
export function MyRequestList({ items, onRemoved }: MyRequestListProps) {
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());
  const [confirmIds, setConfirmIds] = useState<readonly string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  // 상태는 다음 렌더에야 바뀌므로 빠른 두 번 클릭은 ref 로 막는다.
  const busyRef = useRef(false);

  // 목록에서 사라진 요청은 선택에서도 뺀다.
  const selectedItems = items.filter((item) => selectedIds.has(item.request.id));

  function toggle(id: string, selected: boolean) {
    if (busyRef.current) return;
    setFailed(false);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (selected) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function openConfirm() {
    if (busyRef.current || selectedItems.length === 0) return;
    setFailed(false);
    setConfirmIds(selectedItems.map((item) => item.request.id));
  }

  function closeConfirm() {
    if (busyRef.current) return;
    setConfirmIds(null);
  }

  async function confirmDelete() {
    if (busyRef.current || !confirmIds) return;
    busyRef.current = true;
    setBusy(true);

    const ids = confirmIds;
    // async 화살표로 감싸 동기 예외도 실패로 모은다.
    const results = await Promise.allSettled(
      ids.map(async (id) => myRequestService.deleteRequest(id)),
    );
    const removed = ids.filter((_, index) => results[index]?.status === 'fulfilled');

    busyRef.current = false;
    setBusy(false);
    setConfirmIds(null);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      removed.forEach((id) => next.delete(id));
      return next;
    });
    setFailed(removed.length < ids.length);
    if (removed.length > 0) onRemoved(removed);
  }

  const single =
    confirmIds?.length === 1 ? items.find((i) => i.request.id === confirmIds[0]) : null;

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <Text variant="contents">요청 선택하기</Text>
        <span className={styles.trash}>
          <IconButton
            label="선택한 요청 지우기"
            icon={<TrashIcon />}
            disabled={selectedItems.length === 0 || busy}
            onClick={openConfirm}
          />
        </span>
      </div>

      {failed && (
        <p role="alert" className={styles.error}>
          {DELETE_FAILED_TEXT}
        </p>
      )}

      <ul className={styles.cards}>
        {items.map((item) => (
          <li key={item.request.id}>
            <MyRequestCard
              item={item}
              selected={selectedIds.has(item.request.id)}
              onSelectedChange={(selected) => toggle(item.request.id, selected)}
              selectionDisabled={busy}
            />
          </li>
        ))}
      </ul>

      {confirmIds && (
        <ConfirmDialog
          title={
            confirmIds.length === 1
              ? '이 요청을 지울까요?'
              : `선택한 요청 ${confirmIds.length}개를 지울까요?`
          }
          confirmLabel="지우기"
          cancelLabel="취소"
          busy={busy}
          onConfirm={() => void confirmDelete()}
          onCancel={closeConfirm}
        >
          {single
            ? `${single.neighborhood.name} ${single.category.name} 요청이 ${Math.max(0, single.requestCount - 1)}명으로 줄어요. 지운 요청은 되돌릴 수 없어요.`
            : MULTI_BODY}
        </ConfirmDialog>
      )}
    </div>
  );
}
