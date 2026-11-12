import { useRef, useState } from 'react';
import { ChipFieldset } from '@/features/store-request/ChipFieldset';
import {
  VISIT_FREQUENCY_OPTIONS,
  VISIT_REQUIRED_TEXT,
  VISIT_TIME_OPTIONS,
} from '@/features/store-request/constants';
import {
  DEMO_WRITE_BLOCKED_MESSAGE,
  authService,
  describeApiError,
  isApiError,
  requestSubmitter,
} from '@/services';
import { Button } from '@/shared/ui/Button';
import { CloseIcon } from '@/shared/ui/icons';
import { IconButton } from '@/shared/ui/IconButton';
import { Modal } from '@/shared/ui/Modal';
import type { Neighborhood, NeighborhoodReport, VisitFrequency, VisitTime } from '@/types/domain';
import { QUICK_REQUEST_COPY } from './copy';
import styles from './QuickRequestDialog.module.css';

interface QuickRequestDialogProps {
  neighborhood: Neighborhood;
  /** 요청할 카드. 업종은 카드의 업종이다. */
  report: NeighborhoodReport;
  onClose: () => void;
  /**
   * 요청이 서버(목)에 반영됐을 때. added 가 true 면 인원이 늘었고, false 면 이미 요청해 둔 것(ALREADY_REQUESTED)이다.
   * 카드의 인원과 아이콘을 바꾸는 데 쓴다.
   */
  onSent: (categoryId: string, added: boolean) => void;
}

/** 요청을 보낸 뒤 창 안에서 보여줄 결과. 없으면 입력 화면이다. */
type Outcome = { kind: 'goal'; notifiedOwnerCount?: number } | { kind: 'already'; message: string };

/**
 * 간편 요청 창("나도 요청"): 업종이 정해져 있어 문장 입력과 AI 정리가 없고, 방문 시간대(1개 이상)와 빈도만 고른다.
 * 보내면 {동, 업종, 시간대, 빈도}만 서버로 간다. 닫기(×, 배경, Escape)·포커스·Tab 순환은 Modal 이 맡는다.
 * - 기준 인원에 도달했으면(reachedGoal) 창 안에서 "30명이 모였어요!"와 알린 사장님 수를 보여준다. 아니면 창을 닫는다.
 * - ALREADY_REQUESTED 는 기존 안내 문구를 보여주고 카드는 "내가 요청함"으로 바꾼다(인원은 그대로).
 * - 데모 세션은 서버로 보내지 않고 기존 데모 안내를 보여준다.
 */
export function QuickRequestDialog({
  neighborhood,
  report,
  onClose,
  onSent,
}: QuickRequestDialogProps) {
  const { category } = report;
  const [visitTimes, setVisitTimes] = useState<VisitTime[]>([]);
  const [visitFrequency, setVisitFrequency] = useState<VisitFrequency | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  // state 갱신보다 빠른 연타를 막는다.
  const submittingRef = useRef(false);

  const complete = visitTimes.length > 0 && visitFrequency !== null;

  async function send() {
    if (submittingRef.current || !complete || visitFrequency === null) return;
    setError(null);

    // 데모 세션(공유 계정)은 요청을 만들지 않는다(서버 요청 없음). 서비스에도 같은 방어가 있다.
    if (authService.isDemoSession()) {
      setError(DEMO_WRITE_BLOCKED_MESSAGE);
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    try {
      const result = await requestSubmitter.submitQuick({
        neighborhoodId: neighborhood.id,
        categoryId: category.id,
        visitTimes,
        visitFrequency,
      });
      onSent(category.id, true);
      if (result.reachedGoal) {
        setOutcome({ kind: 'goal', notifiedOwnerCount: result.notifiedOwnerCount });
      } else {
        onClose();
      }
    } catch (e) {
      // 서버 message 는 쓰지 않는다. 오류 종류·코드로 정한 문구만 보여준다.
      if (isApiError(e) && e.code === 'ALREADY_REQUESTED') {
        onSent(category.id, false);
        setOutcome({ kind: 'already', message: describeApiError(e) });
      } else {
        setError(describeApiError(e, 'request'));
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  if (outcome) {
    return (
      <Modal
        size="form"
        title={outcome.kind === 'goal' ? QUICK_REQUEST_COPY.goalTitle : QUICK_REQUEST_COPY.title}
        onClose={onClose}
      >
        <span className={styles.close}>
          <IconButton label={QUICK_REQUEST_COPY.close} icon={<CloseIcon />} onClick={onClose} />
        </span>
        {outcome.kind === 'goal' ? (
          // 알린 사장님 수를 서버가 주지 않았으면 숫자 없이 앞 문장만 보여준다.
          outcome.notifiedOwnerCount !== undefined && (
            <p role="status" className={styles.result}>
              {QUICK_REQUEST_COPY.notifiedOwners(outcome.notifiedOwnerCount)}
            </p>
          )
        ) : (
          <p role="alert" className={styles.result}>
            {outcome.message}
          </p>
        )}
        <div className={styles.actions}>
          <Button variant="highlight" size="medium" fullWidth onClick={onClose}>
            {QUICK_REQUEST_COPY.confirm}
          </Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal size="form" title={QUICK_REQUEST_COPY.title} busy={submitting} onClose={onClose}>
      <span className={styles.close}>
        <IconButton
          label={QUICK_REQUEST_COPY.close}
          icon={<CloseIcon />}
          disabled={submitting}
          onClick={onClose}
        />
      </span>
      {/* 어떤 요청에 대한 창인지: 동 이름과 업종 이름 */}
      <p className={styles.target}>
        {neighborhood.name} · {category.cardTitle}
      </p>

      <div className={styles.sections}>
        <ChipFieldset
          legend={QUICK_REQUEST_COPY.timesLegend}
          mode="toggle"
          size="large"
          options={VISIT_TIME_OPTIONS}
          values={visitTimes}
          onChange={(values) => {
            setVisitTimes(values);
            setError(null);
          }}
        />
        <ChipFieldset
          legend={QUICK_REQUEST_COPY.frequencyLegend}
          mode="radio"
          size="large"
          options={VISIT_FREQUENCY_OPTIONS}
          value={visitFrequency}
          onChange={(value) => {
            setVisitFrequency(value);
            setError(null);
          }}
        />
      </div>

      {!complete && <p className={styles.hint}>{VISIT_REQUIRED_TEXT}</p>}
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      <div className={styles.actions}>
        <Button
          variant="highlight"
          size="medium"
          fullWidth
          disabled={!complete}
          loading={submitting}
          onClick={() => void send()}
        >
          {QUICK_REQUEST_COPY.send}
        </Button>
      </div>
    </Modal>
  );
}
