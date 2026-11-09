import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { meService } from '@/services';
import type { Neighborhood, UserRole } from '@/types/domain';

interface Selection {
  role: UserRole | null;
  neighborhood: Neighborhood | null;
}

interface SelectionContextValue extends Selection {
  /**
   * 새로고침 뒤 서버에 저장된 선택을 불러오는 중인지(API 모드에서 저장된 토큰이 있을 때만 true).
   * true 인 동안 선택을 읽는 화면은 "먼저 선택해 주세요" 안내 대신 로딩을 보여준다.
   * mock 모드와 토큰이 없을 때는 항상 false 다.
   */
  restoring: boolean;
  select: (role: UserRole, neighborhood: Neighborhood) => void;
}

const SelectionContext = createContext<SelectionContextValue | null>(null);

/**
 * 역할과 동네 선택을 메모리에만 보관한다(localStorage 에 따로 저장하지 않는다. 원본은 서버다).
 * API 모드에서 저장된 토큰이 있으면 시작할 때 GET /me 로 서버에 저장된 역할·동네를 한 번 불러와 채운다.
 * 복원이 실패하거나 값이 없으면 선택 없는 상태로 동작한다. 사용자가 먼저 선택했다면 복원 값으로 덮어쓰지 않는다.
 * 이 값은 인증이나 접근 권한이 아니라 화면 표시용 선택값이다.
 */
export function SelectionProvider({ children }: { children: ReactNode }) {
  const [selection, setSelection] = useState<Selection>({ role: null, neighborhood: null });
  const [restoring, setRestoring] = useState(() => meService.canRestoreSelection());
  // StrictMode 가 효과를 두 번 실행해도 요청은 한 번만 보낸다.
  const startedRef = useRef(false);

  useEffect(() => {
    if (!restoring || startedRef.current) return;
    startedRef.current = true;
    meService
      .restoreSelection()
      .then(
        (saved) => {
          if (!saved) return;
          // 복원이 끝나기 전에 사용자가 이미 선택했다면 그 선택을 둔다.
          setSelection((current) =>
            current.role !== null || current.neighborhood !== null ? current : saved,
          );
        },
        () => undefined, // 실패하면 선택 없는 상태로 둔다(오류 화면 없음).
      )
      .finally(() => setRestoring(false));
  }, [restoring]);

  const value = useMemo<SelectionContextValue>(
    () => ({
      ...selection,
      restoring,
      select: (role, neighborhood) => {
        setRestoring(false);
        setSelection({ role, neighborhood });
      },
    }),
    [selection, restoring],
  );

  return <SelectionContext value={value}>{children}</SelectionContext>;
}

export function useSelection(): SelectionContextValue {
  const value = useContext(SelectionContext);
  if (!value) throw new Error('useSelection 은 SelectionProvider 안에서만 사용할 수 있어요.');
  return value;
}
