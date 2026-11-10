import type { ReactNode } from 'react';
import { SelectionProvider } from '@/features/selection/SelectionContext';

/** 전역 Provider 모음. 서버 상태 라이브러리 등은 필요해질 때 여기에 추가한다. */
export function AppProviders({ children }: { children: ReactNode }) {
  return <SelectionProvider>{children}</SelectionProvider>;
}
