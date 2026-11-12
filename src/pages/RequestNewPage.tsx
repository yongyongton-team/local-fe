import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { ChipFieldset } from '@/features/store-request/ChipFieldset';
import {
  REQUEST_MAX_LENGTH,
  REQUEST_PLACEHOLDER,
  VISIT_FREQUENCY_OPTIONS,
  VISIT_REQUIRED_TEXT,
  VISIT_TIME_OPTIONS,
} from '@/features/store-request/constants';
import {
  canSubmitRequest,
  describeSummary,
  getCategoryLabel,
  isBlank,
  isDuplicateRequest,
  isVisitInfoMissing,
} from '@/features/store-request/requestForm';
import { SummaryCard } from '@/features/store-request/SummaryCard';
import { useRequestCategoryChoices } from '@/features/store-request/useRequestCategoryChoices';
import { useRequestSummary } from '@/features/store-request/useRequestSummary';
import { NeighborhoodNotice } from '@/features/selection/NeighborhoodNotice';
import { useSelection } from '@/features/selection/SelectionContext';
import {
  ERROR_MESSAGES_BY_CODE,
  describeApiError,
  isApiError,
  requestSubmitter,
  requestSummarizer,
} from '@/services';
import { paths } from '@/shared/lib/paths';
import { LogoLink } from '@/shared/ui/LogoLink';
import { AppBar } from '@/shared/ui/AppBar';
import { Button } from '@/shared/ui/Button';
import { Page } from '@/shared/ui/Page';
import { Text } from '@/shared/ui/Text';
import { TextArea } from '@/shared/ui/TextArea';
import type { Neighborhood, VisitFrequency, VisitTime } from '@/types/domain';
import styles from './RequestNewPage.module.css';

/**
 * 가게 요청하기 (Figma node 2:1549 업종 인식 / 2:1600 업종 선택).
 * 두 디자인은 같은 폼의 두 상태다: 입력 문장에서 업종이 하나로 정해지면 A, 아니면 후보 칩에서 고르는 B.
 * 제출하면 /resident/requests(내 요청)로 이동한다. 별도의 제출 완료 화면은 없다.
 */
export function RequestNewPage() {
  const { neighborhood, restoring } = useSelection();

  // 새로고침 뒤 서버에 저장된 선택을 불러오는 동안은 "먼저 선택해 주세요" 안내를 보여주지 않는다.
  if (restoring) {
    return (
      <Page title="가게 요청하기" backTo={paths.resident}>
        <p role="status">불러오는 중이에요.</p>
      </Page>
    );
  }
  if (!neighborhood) {
    return (
      <Page title="가게 요청하기" backTo={paths.resident}>
        <NeighborhoodNotice />
      </Page>
    );
  }
  return <RequestForm neighborhood={neighborhood} />;
}

const SUBMIT_HINT_ID = 'request-submit-hint';

/** 목 모드(ApiError 가 아닌 오류)의 기존 제출 실패 문구 */
const SUBMIT_FAILED_TEXT = '요청을 보내지 못했어요. 잠시 후 다시 시도해 주세요.';

function RequestForm({ neighborhood }: { neighborhood: Neighborhood }) {
  const navigate = useNavigate();

  const [text, setText] = useState('');
  const [chosenCategoryId, setChosenCategoryId] = useState<string | null>(null);
  const [visitTimes, setVisitTimes] = useState<VisitTime[]>([]);
  const [visitFrequency, setVisitFrequency] = useState<VisitFrequency | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // 시간대·빈도 없이 보내려 한 적이 있는지. 둘 다 고르면 꺼진다(아직 하나만 골랐다면 안내가 남는다).
  const [visitAttempted, setVisitAttempted] = useState(false);
  // 제출 실패 안내 문구(없으면 null). API 오류는 코드별 문구이고 서버 message 는 쓰지 않는다.
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    summary,
    isCurrent,
    error: summaryError,
    pending: summaryPending,
  } = useRequestSummary(text, neighborhood.id);
  const choices = useRequestCategoryChoices();

  // 업종이 문장에서 정해지면 그 업종(A), 아니면 후보 칩에서 고른 업종(B)
  const recognizedCategoryId = summary?.categoryId ?? null;
  const categoryId = recognizedCategoryId ?? chosenCategoryId;
  const categoryLabel = getCategoryLabel(categoryId, choices);
  const showCard = summary !== null;
  const needsChoice = showCard && recognizedCategoryId === null;
  // 서버가 "이미 요청했다"고 알려 준 업종을 지금도 선택하고 있으면 보내기를 막고 기존 ALREADY_REQUESTED 문구를 보여준다.
  const duplicate = isDuplicateRequest(summary, categoryId);
  const cardNotice =
    summaryError ?? (duplicate ? (ERROR_MESSAGES_BY_CODE.ALREADY_REQUESTED ?? null) : null);
  const canSubmit = canSubmitRequest({
    text,
    categoryId,
    summaryIsCurrent: isCurrent,
    duplicate,
  });
  const visitMissing = isVisitInfoMissing(visitTimes, visitFrequency);

  function handleVisitTimesChange(next: VisitTime[]) {
    setVisitTimes(next);
    if (!isVisitInfoMissing(next, visitFrequency)) setVisitAttempted(false);
  }

  function handleVisitFrequencyChange(next: VisitFrequency) {
    setVisitFrequency(next);
    if (!isVisitInfoMissing(visitTimes, next)) setVisitAttempted(false);
  }

  function handleTextChange(value: string) {
    setText(value);
    setSubmitError(null);
    // 입력이 비면 카드가 사라지므로 고른 업종도 함께 비운다.
    if (isBlank(value)) setChosenCategoryId(null);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit || submitting || categoryId === null) return;
    // 서버는 시간대(1개 이상)와 빈도를 필수로 받는다. 비어 있으면 서비스를 부르지 않고 안내만 보여준다(값을 지어내지 않는다).
    if (visitMissing) {
      setVisitAttempted(true);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      await requestSubmitter.submit({
        neighborhoodId: neighborhood.id,
        categoryId,
        detail: text.trim(),
        conditions: summary?.conditions ?? [],
        visitTimes,
        visitFrequency: visitFrequency ?? undefined,
      });
    } catch (error) {
      // 입력은 그대로 유지하고 오류 문구만 보여준다. 입력 문장은 기록하지 않는다.
      setSubmitting(false);
      setSubmitError(isApiError(error) ? describeApiError(error, 'request') : SUBMIT_FAILED_TEXT);
      return;
    }
    void navigate(paths.residentRequests);
  }

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <LogoLink />
        <AppBar title="가게 요청하기" fallbackTo={paths.resident} />
      </header>

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <div className={styles.question}>
          <TextArea
            label="어떤 가게가 생기면 갈까요?"
            labelVariant="display"
            placeholder={REQUEST_PLACEHOLDER}
            maxLength={REQUEST_MAX_LENGTH}
            rows={3}
            value={text}
            onChange={(event) => handleTextChange(event.target.value)}
          />
        </div>

        {/* 서버가 정리하는 동안(약 3초) 카드 자리에 보이는 안내. 기존 로딩 안내와 같은 방식이다. */}
        {summaryPending && (
          <div className={styles.summary}>
            <p role="status">요청 내용을 정리하고 있어요.</p>
          </div>
        )}
        {showCard && (
          <div className={styles.summary}>
            <SummaryCard
              categoryLabel={categoryLabel}
              conditions={summary.conditions}
              needsChoice={needsChoice}
              chosenCategoryId={chosenCategoryId}
              onChooseCategory={setChosenCategoryId}
              choices={choices}
              remote={requestSummarizer.remote}
              error={cardNotice}
            />
          </div>
        )}
        {/* 정리 결과가 바뀔 때 보조 기술에 알린다. 카드와 달리 항상 렌더링해 둔다. */}
        <p className="visually-hidden" aria-live="polite">
          {showCard ? describeSummary(categoryLabel, summary.conditions) : ''}
        </p>

        <div className={styles.sections}>
          <ChipFieldset
            legend="언제 가실 것 같아요?"
            mode="toggle"
            size="large"
            options={VISIT_TIME_OPTIONS}
            values={visitTimes}
            onChange={handleVisitTimesChange}
          />
          <ChipFieldset
            legend="얼마나 자주요?"
            mode="radio"
            size="large"
            options={VISIT_FREQUENCY_OPTIONS}
            value={visitFrequency}
            onChange={handleVisitFrequencyChange}
          />
        </div>
        {visitAttempted && visitMissing && (
          <p role="alert" className={styles.error}>
            {VISIT_REQUIRED_TEXT}
          </p>
        )}

        <Text variant="caption" className={styles.location}>
          위치 : {neighborhood.district} {neighborhood.name} (동 단위로만 저장해요)
        </Text>

        {/* 내용이 짧으면 하단 내비 바로 위에 붙고, 길면 스크롤 끝에 놓인다. */}
        <div className={styles.footer}>
          {submitError && (
            <p role="alert" className={styles.error}>
              {submitError}
            </p>
          )}
          <Button
            type="submit"
            fullWidth
            disabled={!canSubmit}
            loading={submitting}
            aria-describedby={canSubmit ? undefined : SUBMIT_HINT_ID}
          >
            요청 보내기
          </Button>
          {!canSubmit && (
            <span id={SUBMIT_HINT_ID} className="visually-hidden">
              문장을 입력하고 업종이 정해지면 보낼 수 있어요
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
