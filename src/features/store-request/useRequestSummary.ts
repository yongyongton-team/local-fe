import { useEffect, useState } from 'react';
import { requestSummarizer, type RequestSummary } from '@/services';
import { describeLoadError } from '@/features/resident-map/loadErrorText';
import { SUMMARY_DEBOUNCE_MS } from './constants';
import { isBlank } from './requestForm';

interface Result {
  text: string;
  summary: RequestSummary;
  /** 정리에 실패해 직접 고르게 하는 경우의 안내 문구 */
  error: string | null;
}

/** 정리에 실패했을 때 쓰는 결과: 업종 없음 + 조건 없음이라 화면이 업종 칩으로 직접 고르게 한다. */
const MANUAL_CHOICE: RequestSummary = { categoryId: null, conditions: [] };

/**
 * 입력 문장을 정리한다. 입력이 멈춘 뒤 잠시 기다렸다가 정리하고, 그 사이 입력이 바뀌면
 * 이전 요청의 응답은 무시한다(오래된 응답이 최신 입력을 덮어쓰지 않는다). 입력이 바뀌거나 화면을 떠나면 요청을 취소한다.
 * 입력이 비면 결과를 비우고, 입력 문장은 어디에도 기록하지 않는다.
 * 정리가 실패하면(예: AI_UNAVAILABLE) 업종 없음 결과로 대신해 업종 칩으로 직접 고르게 하고, 실패 이유 문구를 error 로 준다.
 *
 * @param neighborhoodId 정리 요청에 쓸 동네 id(서버가 동네별로 정리한다). 없으면 context 없이 정리를 부른다.
 * @returns summary 마지막 정리 결과(입력이 비면 null), isCurrent 그 결과가 현재 문장에 대한 것인지, error 실패 안내(없으면 null)
 */
export function useRequestSummary(text: string, neighborhoodId?: string) {
  const trimmed = text.trim();
  const blank = isBlank(text);
  const [result, setResult] = useState<Result | null>(null);
  const [wasBlank, setWasBlank] = useState(true);

  // 입력이 비면 이전 결과를 비운다(렌더 중 파생 상태 조정).
  if (blank !== wasBlank) {
    setWasBlank(blank);
    if (blank) setResult(null);
  }

  useEffect(() => {
    if (!trimmed) return;
    let stale = false;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const pending =
        neighborhoodId === undefined
          ? requestSummarizer.summarize(trimmed)
          : requestSummarizer.summarize(trimmed, { neighborhoodId, signal: controller.signal });
      pending.then(
        (summary) => {
          if (!stale) setResult({ text: trimmed, summary, error: null });
        },
        (error: unknown) => {
          if (!stale) {
            setResult({
              text: trimmed,
              summary: MANUAL_CHOICE,
              error: describeSummaryError(error),
            });
          }
        },
      );
    }, SUMMARY_DEBOUNCE_MS);
    return () => {
      stale = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed, neighborhoodId]);

  return {
    summary: blank ? null : (result?.summary ?? null),
    isCurrent: !blank && result?.text === trimmed,
    error: blank ? null : (result?.error ?? null),
  };
}

/** 정리 실패 안내. API 오류는 코드별 문구(AI_UNAVAILABLE 은 "업종을 직접 골라 주세요")이고 그 밖의 오류는 기본 문구다. */
function describeSummaryError(error: unknown): string {
  return describeLoadError(error);
}
