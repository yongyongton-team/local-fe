import { useEffect, useState } from 'react';

export type AsyncState<T> =
  { status: 'loading' } | { status: 'error'; error: unknown } | { status: 'success'; data: T };

/**
 * 비동기 데이터를 한 번 불러오는 작은 훅. 서버 상태 라이브러리를 도입하기 전까지만 쓴다.
 * `load` 는 참조가 안정적이어야 한다(모듈 함수 또는 useCallback). 참조가 바뀌면 다시 불러온다.
 * load 에 넘기는 signal 은 참조가 바뀌거나 화면을 떠날 때 abort 된다. 쓰지 않아도 되고, 쓰면 낡은 요청이 취소된다.
 * 취소된 요청의 결과(성공·실패)는 상태에 반영하지 않는다.
 */
export function useAsyncData<T>(load: (signal: AbortSignal) => Promise<T>): AsyncState<T> {
  const [settled, setSettled] = useState<{
    load: (signal: AbortSignal) => Promise<T>;
    state: AsyncState<T>;
  } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    load(controller.signal).then(
      (data) => {
        if (!cancelled) setSettled({ load, state: { status: 'success', data } });
      },
      (error: unknown) => {
        if (!cancelled) setSettled({ load, state: { status: 'error', error } });
      },
    );
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [load]);

  // 다른 load 의 결과(예: 이전 areaId)는 로딩 중으로 취급해 잘못된 데이터를 보여주지 않는다.
  return settled && settled.load === load ? settled.state : { status: 'loading' };
}
