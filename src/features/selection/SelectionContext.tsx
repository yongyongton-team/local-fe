import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Neighborhood, UserRole } from '@/types/domain';

interface Selection {
  role: UserRole | null;
  neighborhood: Neighborhood | null;
}

interface SelectionContextValue extends Selection {
  select: (role: UserRole, neighborhood: Neighborhood) => void;
}

const SelectionContext = createContext<SelectionContextValue | null>(null);

/**
 * 첫 화면에서 고른 역할과 동네를 메모리에만 보관한다. 새로고침하면 초기화된다.
 * 이 값은 인증이나 접근 권한이 아니라 화면 표시용 선택값이다.
 */
export function SelectionProvider({ children }: { children: ReactNode }) {
  const [selection, setSelection] = useState<Selection>({ role: null, neighborhood: null });

  const value = useMemo<SelectionContextValue>(
    () => ({
      ...selection,
      select: (role, neighborhood) => setSelection({ role, neighborhood }),
    }),
    [selection],
  );

  return <SelectionContext value={value}>{children}</SelectionContext>;
}

export function useSelection(): SelectionContextValue {
  const value = useContext(SelectionContext);
  if (!value) throw new Error('useSelection 은 SelectionProvider 안에서만 사용할 수 있어요.');
  return value;
}
