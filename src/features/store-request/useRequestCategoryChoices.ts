import { useMemo } from 'react';
import { demandService, requestSummarizer } from '@/services';
import { useAsyncData } from '@/shared/lib/useAsyncData';
import { REQUEST_CATEGORY_CHOICES } from './constants';

type Choice = { value: string; label: string };

/** 목 모드: 고정된 업종 후보 3개(기존 그대로, 네트워크 없음) */
function useFixedChoices(): readonly Choice[] {
  return REQUEST_CATEGORY_CHOICES;
}

const loadCategories = () => demandService.listCategories();

/** API 모드: 서버 업종 목록 전체(서버 순서 그대로). 불러오는 중이거나 실패하면 빈 목록이다. */
function useServerChoices(): readonly Choice[] {
  const categories = useAsyncData(loadCategories);
  return useMemo(
    () =>
      categories.status === 'success'
        ? categories.data.map((category) => ({ value: category.id, label: category.cardTitle }))
        : [],
    [categories],
  );
}

/**
 * 요청 작성 화면의 업종 후보. 서버가 정리하는 구현(API)이면 서버 업종 목록, 아니면 고정 3개다.
 * 구현은 모듈을 불러올 때 한 번 정해진다(훅 호출 순서가 바뀌지 않는다).
 */
export const useRequestCategoryChoices: () => readonly Choice[] = requestSummarizer.remote
  ? useServerChoices
  : useFixedChoices;
