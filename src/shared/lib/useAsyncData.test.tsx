import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useAsyncData } from './useAsyncData';

/** 밖에서 끝낼 수 있는 Promise */
function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  let reject: (error: unknown) => void = () => undefined;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('useAsyncData', () => {
  it('성공 데이터와 실패 오류(error)를 상태로 돌려준다', async () => {
    const loadOk = () => Promise.resolve('값');
    const ok = renderHook(() => useAsyncData(loadOk));
    expect(ok.result.current).toEqual({ status: 'loading' });
    await act(async () => undefined);
    expect(ok.result.current).toEqual({ status: 'success', data: '값' });

    const boom = new Error('boom');
    const loadFail = () => Promise.reject(boom);
    const fail = renderHook(() => useAsyncData(loadFail));
    await act(async () => undefined);
    expect(fail.result.current).toEqual({ status: 'error', error: boom });
  });

  it('load 가 바뀌면 이전 요청의 signal 을 abort 하고, signal 을 무시한 낡은 응답도 반영하지 않는다', async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const signals: AbortSignal[] = [];
    const loadA = (signal: AbortSignal) => (signals.push(signal), first.promise);
    const loadB = (signal: AbortSignal) => (signals.push(signal), second.promise);

    const { result, rerender } = renderHook(({ load }) => useAsyncData(load), {
      initialProps: { load: loadA },
    });
    rerender({ load: loadB });

    expect(signals[0]?.aborted).toBe(true);
    expect(signals[1]?.aborted).toBe(false);

    await act(async () => second.resolve('B'));
    expect(result.current).toEqual({ status: 'success', data: 'B' });
    // 취소된 요청이 뒤늦게 성공하거나 실패해도 B 의 결과를 덮어쓰지 않는다.
    await act(async () => first.resolve('A'));
    expect(result.current).toEqual({ status: 'success', data: 'B' });
  });

  it('화면을 떠나면(unmount) signal 이 abort 된다', () => {
    let seen: AbortSignal | undefined;
    const load = (signal: AbortSignal) => ((seen = signal), new Promise<string>(() => undefined));
    const { unmount } = renderHook(() => useAsyncData(load));
    expect(seen?.aborted).toBe(false);

    unmount();

    expect(seen?.aborted).toBe(true);
  });
});
