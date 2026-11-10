import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { requestSummarizer, type RequestSummary } from '@/services';
import { PARSE_DEBOUNCE_MS } from './constants';
import { useRequestSummary } from './useRequestSummary';

const ok = (categoryId: string | null): RequestSummary => ({
  categoryId,
  conditions: [],
  alreadyRequested: false,
});
const advance = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
const type = (rerender: (props: { text: string }) => void, text: string) =>
  act(() => {
    rerender({ text });
  });

describe('요청 정리 호출 시점(백엔드 명세: 입력이 0.8초 멈추면 한 번만)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });
  const setup = (initial = '') => {
    const spy = vi.spyOn(requestSummarizer, 'summarize').mockResolvedValue(ok('bakery'));
    const hook = renderHook(({ text }) => useRequestSummary(text, '22'), {
      initialProps: { text: initial },
    });
    return { spy, ...hook };
  };

  it('지연은 800ms 다', () => {
    expect(PARSE_DEBOUNCE_MS).toBe(800);
  });

  it('800ms 전에는 부르지 않고, 연속 입력은 마지막 글로 한 번만 부른다', async () => {
    const { spy, rerender } = setup();

    await type(rerender, '빵');
    await advance(500);
    await type(rerender, '빵집');
    await advance(500);
    await type(rerender, '빵집이');
    await advance(PARSE_DEBOUNCE_MS - 1);
    expect(spy).not.toHaveBeenCalled();

    await advance(1);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('빵집이', expect.objectContaining({ neighborhoodId: '22' }));
  });

  it('공백뿐이거나 비어 있으면 부르지 않는다', async () => {
    const { spy, rerender } = setup();

    await type(rerender, '   ');
    await advance(PARSE_DEBOUNCE_MS * 2);

    expect(spy).not.toHaveBeenCalled();
  });

  it('앞뒤 공백을 뺀 글이 마지막으로 성공한 호출과 같으면 다시 부르지 않는다', async () => {
    const { spy, rerender } = setup();
    await type(rerender, '빵집');
    await advance(PARSE_DEBOUNCE_MS);
    expect(spy).toHaveBeenCalledTimes(1);

    // 지우다가 같은 글로 돌아와도(공백만 달라도) 새 호출이 없다.
    await type(rerender, '빵집!');
    await advance(300);
    await type(rerender, '  빵집  ');
    await advance(PARSE_DEBOUNCE_MS * 2);

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('다른 글의 호출이 끝난 뒤 원래 글로 돌아오면 다시 부른다', async () => {
    const { spy, rerender } = setup();
    await type(rerender, '빵집');
    await advance(PARSE_DEBOUNCE_MS);
    await type(rerender, '반찬');
    await advance(PARSE_DEBOUNCE_MS);
    expect(spy).toHaveBeenCalledTimes(2);

    await type(rerender, '빵집');
    await advance(PARSE_DEBOUNCE_MS);

    expect(spy).toHaveBeenCalledTimes(3);
  });

  it('입력을 비웠다가 같은 글을 다시 쓰면 결과가 비었으므로 다시 부른다', async () => {
    const { spy, result, rerender } = setup();
    await type(rerender, '빵집');
    await advance(PARSE_DEBOUNCE_MS);
    await type(rerender, '');
    expect(result.current.summary).toBeNull();

    await type(rerender, '빵집');
    await advance(PARSE_DEBOUNCE_MS);

    expect(spy).toHaveBeenCalledTimes(2);
    expect(result.current.summary).not.toBeNull();
  });

  it('실패한 글은 성공으로 치지 않는다(다른 글 뒤에 같은 글로 돌아오면 다시 부른다)', async () => {
    const spy = vi.spyOn(requestSummarizer, 'summarize');
    spy.mockRejectedValueOnce(new Error('x')).mockResolvedValue(ok('bakery'));
    const { rerender } = renderHook(({ text }) => useRequestSummary(text, '22'), {
      initialProps: { text: '빵집' },
    });
    await advance(PARSE_DEBOUNCE_MS);
    await type(rerender, '반찬');
    await advance(PARSE_DEBOUNCE_MS);
    await type(rerender, '빵집');
    await advance(PARSE_DEBOUNCE_MS);

    expect(spy).toHaveBeenCalledTimes(3);
  });

  it('동네가 바뀌면 같은 글이라도 다시 부른다', async () => {
    const spy = vi.spyOn(requestSummarizer, 'summarize').mockResolvedValue(ok('bakery'));
    const { rerender } = renderHook(({ id }) => useRequestSummary('빵집', id), {
      initialProps: { id: '22' },
    });
    await advance(PARSE_DEBOUNCE_MS);

    rerender({ id: '28' });
    await advance(PARSE_DEBOUNCE_MS);

    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('새 입력이 오면 진행 중인 요청을 중단(AbortSignal)하고 낡은 응답은 무시한다', async () => {
    const signals: AbortSignal[] = [];
    let release: (value: RequestSummary) => void = () => undefined;
    vi.spyOn(requestSummarizer, 'summarize').mockImplementation(async (_text, ctx) => {
      if (ctx?.signal) signals.push(ctx.signal);
      return new Promise<RequestSummary>((resolve) => (release = resolve));
    });
    const { result, rerender } = renderHook(({ text }) => useRequestSummary(text, '22'), {
      initialProps: { text: '빵집' },
    });
    await advance(PARSE_DEBOUNCE_MS);
    expect(signals[0]?.aborted).toBe(false);

    await type(rerender, '빵집이');
    expect(signals[0]?.aborted).toBe(true);
    await act(async () => release(ok('bakery')));

    expect(result.current.summary).toBeNull();
  });

  it('화면을 떠나면(언마운트) 대기 중인 호출은 부르지 않고 진행 중인 요청은 중단한다', async () => {
    const signals: AbortSignal[] = [];
    const spy = vi.spyOn(requestSummarizer, 'summarize').mockImplementation(async (_t, ctx) => {
      if (ctx?.signal) signals.push(ctx.signal);
      return new Promise<RequestSummary>(() => undefined);
    });
    const waiting = renderHook(() => useRequestSummary('빵집', '22'));
    await advance(PARSE_DEBOUNCE_MS - 100);

    waiting.unmount();
    await advance(PARSE_DEBOUNCE_MS * 2);
    expect(spy).not.toHaveBeenCalled();

    const inflight = renderHook(() => useRequestSummary('반찬', '22'));
    await advance(PARSE_DEBOUNCE_MS);
    expect(signals).toHaveLength(1);
    inflight.unmount();
    expect(signals[0]?.aborted).toBe(true);
  });
});
