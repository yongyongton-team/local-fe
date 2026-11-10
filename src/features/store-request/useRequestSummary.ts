import { useEffect, useRef, useState } from 'react';
import { requestSummarizer, type RequestSummary } from '@/services';
import { describeLoadError } from '@/features/resident-map/loadErrorText';
import { PARSE_DEBOUNCE_MS } from './constants';
import { isBlank } from './requestForm';

interface Result {
  text: string;
  summary: RequestSummary;
  /** 정리에 실패해 직접 고르게 하는 경우의 안내 문구 */
  error: string | null;
}

/** 정리에 실패했을 때 쓰는 결과: 업종 없음 + 조건 없음이라 화면이 업종 칩으로 직접 고르게 한다. */
const MANUAL_CHOICE: RequestSummary = { categoryId: null, conditions: [], alreadyRequested: false };

/**
 * 입력 문장을 정리한다. 마지막 입력 후 PARSE_DEBOUNCE_MS(0.8초) 뒤에 한 번만 부르고, 그 사이 입력이 바뀌면 대기 중인 호출을
 * 취소하며 이전 요청의 응답은 무시한다(오래된 응답이 최신 입력을 덮어쓰지 않는다). 입력이 바뀌거나 화면을 떠나면 진행 중인 요청도 중단(AbortSignal)한다.
 * 글이 비었거나(공백 제외) 마지막으로 성공한 호출과 같은 글이면 부르지 않는다.
 * 입력이 비면 결과를 비우고, 입력 문장은 어디에도 기록하지 않는다.
 * 정리가 실패하면(예: AI_UNAVAILABLE) 업종 없음 결과로 대신해 업종 칩으로 직접 고르게 하고, 실패 이유 문구를 error 로 준다.
 *
 * @param neighborhoodId 정리 요청에 쓸 동네 id(서버가 동네별로 정리한다). 없으면 context 없이 정리를 부른다.
 * @returns summary 마지막 정리 결과(입력이 비면 null), isCurrent 그 결과가 현재 문장에 대한 것인지, error 실패 안내(없으면 null),
 *          pending 응답을 기다리는 중인지
 */
export function useRequestSummary(text: string, neighborhoodId?: string) {
  const trimmed = text.trim();
  const blank = isBlank(text);
  const [result, setResult] = useState<Result | null>(null);
  const [wasBlank, setWasBlank] = useState(true);
  // 호출이 시작된 문장. 응답이 올 때까지 "정리하는 중"을 보여주는 근거다(서버가 정리하는 구현에서만 쓴다).
  const [pendingText, setPendingText] = useState<string | null>(null);
  // 마지막으로 성공한 호출의 글과 동네. 같은 글이면(예: 지웠다가 다시 같은 글로 돌아옴) 다시 부르지 않는다.
  const lastSuccessRef = useRef<{ text: string; neighborhoodId?: string } | null>(null);

  // 입력이 비면 이전 결과를 비운다(렌더 중 파생 상태 조정).
  if (blank !== wasBlank) {
    setWasBlank(blank);
    if (blank) setResult(null);
  }

  useEffect(() => {
    if (!trimmed) {
      lastSuccessRef.current = null;
      return;
    }
    // 마지막으로 성공한 호출과 같은 글(같은 동네)이면 부르지 않는다.
    const last = lastSuccessRef.current;
    if (last && last.text === trimmed && last.neighborhoodId === neighborhoodId) return;
    let stale = false;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      if (requestSummarizer.remote) setPendingText(trimmed);
      const call =
        neighborhoodId === undefined
          ? requestSummarizer.summarize(trimmed)
          : requestSummarizer.summarize(trimmed, { neighborhoodId, signal: controller.signal });
      call.then(
        (summary) => {
          if (!stale) {
            lastSuccessRef.current = { text: trimmed, neighborhoodId };
            setPendingText(null);
            setResult({ text: trimmed, summary, error: null });
          }
        },
        (error: unknown) => {
          if (!stale) {
            setPendingText(null);
            setResult({
              text: trimmed,
              summary: MANUAL_CHOICE,
              error: describeSummaryError(error),
            });
          }
        },
      );
    }, PARSE_DEBOUNCE_MS);
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
    /** 호출을 시작했고 응답을 기다리는 중인지(입력 지연 동안은 아니다). 목 구현에서는 항상 false. */
    pending: !blank && pendingText === trimmed,
  };
}

/** 정리 실패 안내. API 오류는 코드별 문구(AI_UNAVAILABLE 은 "업종을 직접 골라 주세요")이고 그 밖의 오류는 기본 문구다. */
function describeSummaryError(error: unknown): string {
  return describeLoadError(error);
}
