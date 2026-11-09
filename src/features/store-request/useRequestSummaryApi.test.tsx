import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { requestSummarizer } from '@/services';
import { ApiError } from '@/services/api/apiError';
import { SUMMARY_DEBOUNCE_MS } from './constants';
import { useRequestSummary } from './useRequestSummary';

const advanceDebounce = () =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(SUMMARY_DEBOUNCE_MS + 1);
  });

describe('useRequestSummary 의 동네 id·취소·실패 처리', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('동네 id 가 있으면 context 로 넘기고, 입력이 바뀌거나 화면을 떠나면 이전 요청을 취소한다', async () => {
    const signals: (AbortSignal | undefined)[] = [];
    const spy = vi.spyOn(requestSummarizer, 'summarize').mockImplementation(async (_text, ctx) => {
      signals.push(ctx?.signal);
      return new Promise(() => undefined);
    });
    const { rerender, unmount } = renderHook(({ text }) => useRequestSummary(text, '28'), {
      initialProps: { text: '빵' },
    });
    await advanceDebounce();
    expect(spy).toHaveBeenCalledWith('빵', expect.objectContaining({ neighborhoodId: '28' }));
    expect(signals[0]?.aborted).toBe(false);

    rerender({ text: '빵집' });
    expect(signals[0]?.aborted).toBe(true);
    await advanceDebounce();
    expect(signals[1]?.aborted).toBe(false);

    unmount();
    expect(signals[1]?.aborted).toBe(true);
  });

  it('정리가 실패하면 업종 없음 결과(직접 선택)와 코드별 안내 문구를 준다', async () => {
    vi.spyOn(requestSummarizer, 'summarize').mockRejectedValue(
      new ApiError({ kind: 'http', status: 502, code: 'AI_UNAVAILABLE', message: '서버 원문' }),
    );
    const { result } = renderHook(() => useRequestSummary('문장', '28'));

    await advanceDebounce();

    expect(result.current.summary).toEqual({ categoryId: null, conditions: [] });
    expect(result.current.isCurrent).toBe(true);
    expect(result.current.error).toBe('요청 내용을 정리하지 못했어요. 업종을 직접 골라 주세요.');
  });

  it('성공하면 error 는 null 이고, 입력이 비면 결과와 error 를 비운다', async () => {
    vi.spyOn(requestSummarizer, 'summarize').mockRejectedValueOnce(new Error('boom'));
    const { result, rerender } = renderHook(({ text }) => useRequestSummary(text, '28'), {
      initialProps: { text: '문장' },
    });
    await advanceDebounce();
    expect(result.current.error).toBe('잠시 후 다시 시도해 주세요.');

    rerender({ text: '  ' });

    expect(result.current).toEqual({ summary: null, isCurrent: false, error: null });
  });
});
