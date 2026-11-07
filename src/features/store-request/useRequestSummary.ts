import { useEffect, useState } from 'react';
import { requestSummarizer, type RequestSummary } from '@/services';
import { SUMMARY_DEBOUNCE_MS } from './constants';
import { isBlank } from './requestForm';

interface Result {
  text: string;
  summary: RequestSummary;
}

/**
 * 입력 문장을 정리한다. 입력이 멈춘 뒤 잠시 기다렸다가 정리하고, 그 사이 입력이 바뀌면
 * 이전 요청의 응답은 무시한다(오래된 응답이 최신 입력을 덮어쓰지 않는다).
 * 입력이 비면 결과를 비우고, 입력 문장은 어디에도 기록하지 않는다.
 *
 * @returns summary 마지막 정리 결과(입력이 비면 null), isCurrent 그 결과가 현재 문장에 대한 것인지
 */
export function useRequestSummary(text: string) {
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
    const timer = setTimeout(() => {
      requestSummarizer.summarize(trimmed).then(
        (summary) => {
          if (!stale) setResult({ text: trimmed, summary });
        },
        () => undefined,
      );
    }, SUMMARY_DEBOUNCE_MS);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [trimmed]);

  return {
    summary: blank ? null : (result?.summary ?? null),
    isCurrent: !blank && result?.text === trimmed,
  };
}
