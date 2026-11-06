import { useEffect, useState } from 'react';

export type AsyncState<T> =
  { status: 'loading' } | { status: 'error' } | { status: 'success'; data: T };

/**
 * 비동기 데이터를 한 번 불러오는 작은 훅. 서버 상태 라이브러리를 도입하기 전까지만 쓴다.
 * `load` 는 참조가 안정적이어야 한다(모듈 함수 또는 useCallback). 참조가 바뀌면 다시 불러온다.
 */
export function useAsyncData<T>(load: () => Promise<T>): AsyncState<T> {
  const [settled, setSettled] = useState<{ load: () => Promise<T>; state: AsyncState<T> } | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    load().then(
      (data) => {
        if (!cancelled) setSettled({ load, state: { status: 'success', data } });
      },
      () => {
        if (!cancelled) setSettled({ load, state: { status: 'error' } });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [load]);

  // 다른 load 의 결과(예: 이전 areaId)는 로딩 중으로 취급해 잘못된 데이터를 보여주지 않는다.
  return settled && settled.load === load ? settled.state : { status: 'loading' };
}
