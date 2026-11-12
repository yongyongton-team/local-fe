import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { requestSummarizer, type RequestSummary } from '@/services';
import { PARSE_DEBOUNCE_MS } from './constants';
import { useRequestSummary } from './useRequestSummary';

const summary = (categoryId: string | null): RequestSummary => ({ categoryId, conditions: [] });

/** 응답 시점을 직접 정할 수 있는 요청. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

const advanceDebounce = () =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(PARSE_DEBOUNCE_MS + 1);
  });

describe('useRequestSummary', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('입력이 멈춘 뒤 한 번만 정리한다(그 전에는 호출하지 않는다)', async () => {
    const spy = vi.spyOn(requestSummarizer, 'summarize').mockResolvedValue(summary('bakery'));
    const { result, rerender } = renderHook(({ text }) => useRequestSummary(text), {
      initialProps: { text: '빵' },
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(PARSE_DEBOUNCE_MS - 100);
    });
    expect(spy).not.toHaveBeenCalled();
    expect(result.current.summary).toBeNull();

    // 지연 안에 입력이 또 바뀌면 이전 예약은 취소된다.
    rerender({ text: '빵집' });
    await advanceDebounce();

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('빵집');
    expect(result.current.summary?.categoryId).toBe('bakery');
    expect(result.current.isCurrent).toBe(true);
  });

  it('이전 요청의 늦은 응답이 최신 입력의 결과를 덮어쓰지 않는다', async () => {
    const first = deferred<RequestSummary>();
    const second = deferred<RequestSummary>();
    const spy = vi
      .spyOn(requestSummarizer, 'summarize')
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);
    const { result, rerender } = renderHook(({ text }) => useRequestSummary(text), {
      initialProps: { text: '과일' },
    });

    await advanceDebounce(); // '과일' 요청 시작(응답 대기)
    rerender({ text: '반찬' });
    await advanceDebounce(); // '반찬' 요청 시작
    expect(spy).toHaveBeenCalledTimes(2);

    // 최신 요청이 먼저 끝나고, 오래된 요청이 나중에 끝난다.
    await act(async () => second.resolve(summary('side-dish')));
    await act(async () => first.resolve(summary('fruit-vegetable')));

    expect(result.current.summary?.categoryId).toBe('side-dish');
    expect(result.current.isCurrent).toBe(true);
  });

  it('입력을 바꾼 직후에는 결과가 최신이 아님(isCurrent=false)을 알린다', async () => {
    vi.spyOn(requestSummarizer, 'summarize').mockResolvedValue(summary('bakery'));
    const { result, rerender } = renderHook(({ text }) => useRequestSummary(text), {
      initialProps: { text: '빵집' },
    });
    await advanceDebounce();
    expect(result.current.isCurrent).toBe(true);

    rerender({ text: '빵집이요' });

    expect(result.current.isCurrent).toBe(false);
    // 다시 정리되기 전까지는 직전 결과를 유지해 화면이 깜빡이지 않는다.
    expect(result.current.summary?.categoryId).toBe('bakery');
  });

  it('입력이 비면 결과를 비우고 정리를 요청하지 않는다', async () => {
    const spy = vi.spyOn(requestSummarizer, 'summarize').mockResolvedValue(summary('bakery'));
    const { result, rerender } = renderHook(({ text }) => useRequestSummary(text), {
      initialProps: { text: '빵집' },
    });
    await advanceDebounce();
    expect(result.current.summary).not.toBeNull();

    rerender({ text: '   ' });
    await advanceDebounce();

    expect(result.current.summary).toBeNull();
    expect(result.current.isCurrent).toBe(false);
    expect(spy).toHaveBeenCalledTimes(1);

    // 다시 입력해도 이전 세션의 결과가 먼저 보이지 않는다.
    rerender({ text: '과일' });
    expect(result.current.summary).toBeNull();
  });
});
