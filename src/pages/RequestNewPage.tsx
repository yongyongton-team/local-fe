import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { ChipFieldset } from '@/features/store-request/ChipFieldset';
import {
  REQUEST_MAX_LENGTH,
  REQUEST_PLACEHOLDER,
  VISIT_FREQUENCY_OPTIONS,
  VISIT_TIME_OPTIONS,
} from '@/features/store-request/constants';
import {
  canSubmitRequest,
  describeSummary,
  getCategoryLabel,
  isBlank,
} from '@/features/store-request/requestForm';
import { SummaryCard } from '@/features/store-request/SummaryCard';
import { useRequestSummary } from '@/features/store-request/useRequestSummary';
import { NeighborhoodNotice } from '@/features/selection/NeighborhoodNotice';
import { useSelection } from '@/features/selection/SelectionContext';
import { requestSubmitter } from '@/services';
import logo from '@/shared/assets/logo.png';
import { paths } from '@/shared/lib/paths';
import { Button } from '@/shared/ui/Button';
import { IconButton } from '@/shared/ui/IconButton';
import { ArrowLeftIcon } from '@/shared/ui/icons';
import { Page } from '@/shared/ui/Page';
import { Text } from '@/shared/ui/Text';
import { TextArea } from '@/shared/ui/TextArea';
import type { Neighborhood, VisitFrequency, VisitTime } from '@/types/domain';
import styles from './RequestNewPage.module.css';

/**
 * 가게 요청하기 (Figma node 2:1549 업종 인식 / 2:1600 업종 선택).
 * 두 디자인은 같은 폼의 두 상태다: 입력 문장에서 업종이 하나로 정해지면 A, 아니면 후보 칩에서 고르는 B.
 * 제출하면 임시로 /resident/requests(내 요청)로 이동한다. 제출 완료 화면은 이번 범위가 아니다.
 */
export function RequestNewPage() {
  const { neighborhood } = useSelection();

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

function RequestForm({ neighborhood }: { neighborhood: Neighborhood }) {
  const navigate = useNavigate();
  const location = useLocation();

  const [text, setText] = useState('');
  const [chosenCategoryId, setChosenCategoryId] = useState<string | null>(null);
  const [visitTimes, setVisitTimes] = useState<VisitTime[]>([]);
  const [visitFrequency, setVisitFrequency] = useState<VisitFrequency | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitFailed, setSubmitFailed] = useState(false);

  const { summary, isCurrent } = useRequestSummary(text);

  // 업종이 문장에서 정해지면 그 업종(A), 아니면 후보 칩에서 고른 업종(B)
  const recognizedCategoryId = summary?.categoryId ?? null;
  const categoryId = recognizedCategoryId ?? chosenCategoryId;
  const categoryLabel = getCategoryLabel(categoryId);
  const showCard = summary !== null;
  const needsChoice = showCard && recognizedCategoryId === null;
  const canSubmit = canSubmitRequest({ text, categoryId, summaryIsCurrent: isCurrent });

  function handleTextChange(value: string) {
    setText(value);
    setSubmitFailed(false);
    // 입력이 비면 카드가 사라지므로 고른 업종도 함께 비운다.
    if (isBlank(value)) setChosenCategoryId(null);
  }

  /** 앱 안에서 이전 화면이 있으면 그 화면으로, 직접 진입했으면 /resident 로 간다. */
  function goBack() {
    // location.key 가 'default' 이면 이 앱에서 처음 연 화면(직접 진입)이다.
    if (location.key === 'default') {
      void navigate(paths.resident);
    } else {
      void navigate(-1);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit || submitting || categoryId === null) return;

    setSubmitting(true);
    setSubmitFailed(false);
    try {
      await requestSubmitter.submit({
        neighborhoodId: neighborhood.id,
        categoryId,
        detail: text.trim(),
        conditions: summary?.conditions ?? [],
        visitTimes,
        visitFrequency: visitFrequency ?? undefined,
      });
    } catch {
      // 입력은 그대로 유지하고 오류 문구만 보여준다. 입력 문장은 기록하지 않는다.
      setSubmitting(false);
      setSubmitFailed(true);
      return;
    }
    void navigate(paths.residentRequests);
  }

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <img src={logo} alt="생기면 갈게요" width={129} height={43} className={styles.logo} />
        <div className={styles.appBar}>
          <IconButton label="뒤로 가기" icon={<ArrowLeftIcon />} onClick={goBack} />
          <Text as="h1" variant="title" className={styles.appBarTitle}>
            가게 요청하기
          </Text>
        </div>
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

        {showCard && (
          <div className={styles.summary}>
            <SummaryCard
              categoryLabel={categoryLabel}
              conditions={summary.conditions}
              needsChoice={needsChoice}
              chosenCategoryId={chosenCategoryId}
              onChooseCategory={setChosenCategoryId}
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
            onChange={setVisitTimes}
          />
          <ChipFieldset
            legend="얼마나 자주요?"
            mode="radio"
            size="large"
            options={VISIT_FREQUENCY_OPTIONS}
            value={visitFrequency}
            onChange={setVisitFrequency}
          />
        </div>

        <Text variant="caption" className={styles.location}>
          위치 : {neighborhood.district} {neighborhood.name} (동 단위로만 저장해요)
        </Text>

        {/* 내용이 짧으면 하단 내비 바로 위에 붙고, 길면 스크롤 끝에 놓인다. */}
        <div className={styles.footer}>
          {submitFailed && (
            <p role="alert" className={styles.error}>
              요청을 보내지 못했어요. 잠시 후 다시 시도해 주세요.
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
