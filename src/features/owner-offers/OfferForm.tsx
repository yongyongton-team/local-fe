import { useId, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { describeApiError, offerService } from '@/services';
import {
  OFFER_DESCRIPTION_MAX,
  OFFER_PICKUP_PLACE_MAX,
  OFFER_TITLE_MAX,
} from '@/shared/lib/inputLimits';
import { formatMonthDay24h, formatMonthDayMeridiem, parseKstInput } from '@/shared/lib/kstDate';
import { paths } from '@/shared/lib/paths';
import { Button } from '@/shared/ui/Button';
import { Modal } from '@/shared/ui/Modal';
import type { OfferSent } from '@/types/domain';
import { OFFER_COPY } from './copy';
import { DateTimeField } from './DateTimeField';
import {
  EMPTY_OFFER_FORM,
  checkOfferForm,
  clampMinOrders,
  deadlineError,
  firstHint,
  isPriceWithinLimit,
  sanitizePrice,
  type OfferFormValues,
} from './formValidation';
import type { OfferContext } from './useOfferContext';
import styles from './OfferForm.module.css';

const displayWith = (format: (date: Date) => string) => (value: string) => {
  const date = parseKstInput(value);
  return date ? format(date) : value;
};

/**
 * 방문 판매 제안 작성 폼(Figma 45:542). 동네·업종은 context(내 가게의 업종, 제안 대상 동네)에서 가져온다.
 * 보내는 동안은 버튼을 막아 중복 제출을 막고, 성공하면 알림 보낸 주민 수를 Modal 로 알린 뒤 내 가게(제안 목록)로 간다.
 */
export function OfferForm({ context }: { context: OfferContext }) {
  const navigate = useNavigate();
  const [values, setValues] = useState<OfferFormValues>(EMPTY_OFFER_FORM);
  const [dirty, setDirty] = useState(false);
  // 마감 검증의 "지금". 입력할 때와 보내기 직전에 새로 읽는다(시간이 지나 마감이 지났을 수 있다).
  const [now, setNow] = useState(() => new Date());
  // 가격이 int32 최댓값을 넘는 입력을 막았을 때 안내를 보이기 위한 표시
  const [priceTooHigh, setPriceTooHigh] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<OfferSent | null>(null);
  // state 갱신보다 빠른 연타도 막으려고 ref 로 확인한다.
  const submittingRef = useRef(false);
  const deadlineErrorId = useId();
  const minOrdersLabelId = useId();
  const titleId = useId();
  const descriptionId = useId();
  const priceId = useId();
  const placeId = useId();
  const sentBodyId = useId();

  const check = checkOfferForm(values, now);
  const hint = dirty ? firstHint(check) : null;
  const deadlineMessage = deadlineError(check);

  function update(patch: Partial<OfferFormValues>) {
    setValues((current) => ({ ...current, ...patch }));
    setNow(new Date());
    setDirty(true);
    setError(null);
  }

  const goToList = () => void navigate(paths.merchantOffers(context.areaId), { replace: true });

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submittingRef.current) return;
    // 보내기 직전의 시각으로 다시 검사한다. 마감이 그새 지났으면 오류를 보이고 보내지 않는다.
    const submitTime = new Date();
    if (!checkOfferForm(values, submitTime).canSubmit) {
      setNow(submitTime);
      return;
    }
    const pickupAt = parseKstInput(values.pickupAt);
    const deadlineAt = parseKstInput(values.deadlineAt);
    if (!pickupAt || !deadlineAt) return;
    setError(null);

    submittingRef.current = true;
    setSubmitting(true);
    try {
      const result = await offerService.createOffer({
        neighborhoodId: context.areaId,
        categoryId: context.profile.categoryId,
        title: values.title,
        ...(values.description.trim() !== '' && { description: values.description }),
        price: Number(values.price),
        minOrders: values.minOrders,
        pickupAt,
        pickupPlace: values.pickupPlace,
        deadlineAt,
      });
      setSent(result);
    } catch (e) {
      // 서버 message 는 쓰지 않는다. 오류 종류·코드로 정한 문구만 보여준다.
      setError(describeApiError(e, 'offer'));
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <>
      <form className={styles.form} onSubmit={(event) => void handleSubmit(event)} noValidate>
        <div className={styles.field}>
          <label htmlFor={titleId} className={styles.label}>
            {OFFER_COPY.fieldTitle}
          </label>
          <input
            id={titleId}
            type="text"
            className={`${styles.box} ${styles.input}`}
            autoComplete="off"
            maxLength={OFFER_TITLE_MAX}
            placeholder={OFFER_COPY.titlePlaceholder}
            value={values.title}
            onChange={(event) => update({ title: event.target.value })}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor={descriptionId} className={styles.label}>
            {OFFER_COPY.fieldDescription}
          </label>
          <input
            id={descriptionId}
            type="text"
            className={`${styles.box} ${styles.input}`}
            autoComplete="off"
            maxLength={OFFER_DESCRIPTION_MAX}
            placeholder={OFFER_COPY.descriptionPlaceholder}
            value={values.description}
            onChange={(event) => update({ description: event.target.value })}
          />
        </div>

        <div className={styles.pair}>
          <div className={styles.field}>
            <label htmlFor={priceId} className={styles.label}>
              {OFFER_COPY.fieldPrice}
            </label>
            <div className={`${styles.box} ${styles.priceBox}`}>
              <input
                id={priceId}
                type="text"
                inputMode="numeric"
                className={styles.bareInput}
                autoComplete="off"
                placeholder={OFFER_COPY.pricePlaceholder}
                value={values.price === '' ? '' : Number(values.price).toLocaleString('ko-KR')}
                onChange={(event) => {
                  const next = sanitizePrice(event.target.value);
                  // int32 최댓값을 넘는 입력은 받지 않고(이전 값 유지) 안내만 보인다.
                  if (!isPriceWithinLimit(next)) {
                    setPriceTooHigh(true);
                    return;
                  }
                  setPriceTooHigh(false);
                  update({ price: next });
                }}
              />
              <span className={styles.unit} aria-hidden="true">
                {OFFER_COPY.priceUnit}
              </span>
            </div>
          </div>

          <div className={styles.field} role="group" aria-labelledby={minOrdersLabelId}>
            <p id={minOrdersLabelId} className={styles.label}>
              {OFFER_COPY.fieldMinOrders}
            </p>
            <div className={`${styles.box} ${styles.stepper}`}>
              <span className={styles.stepValue} aria-live="polite">
                {values.minOrders}
                {OFFER_COPY.minOrdersUnit}
              </span>
              <button
                type="button"
                className={styles.stepButton}
                aria-label={OFFER_COPY.minOrdersDecrease}
                onClick={() => update({ minOrders: clampMinOrders(values.minOrders - 1) })}
              >
                −
              </button>
              <button
                type="button"
                className={styles.stepButton}
                aria-label={OFFER_COPY.minOrdersIncrease}
                onClick={() => update({ minOrders: clampMinOrders(values.minOrders + 1) })}
              >
                +
              </button>
            </div>
          </div>
        </div>

        {priceTooHigh && (
          <p role="alert" className={styles.error}>
            {OFFER_COPY.outOfRange.price}
          </p>
        )}

        <DateTimeField
          label={OFFER_COPY.fieldPickupAt}
          value={values.pickupAt}
          display={displayWith(formatMonthDayMeridiem)}
          placeholder={OFFER_COPY.pickPlaceholder}
          onChange={(pickupAt) => update({ pickupAt })}
        />

        <div className={styles.field}>
          <label htmlFor={placeId} className={styles.label}>
            {OFFER_COPY.fieldPickupPlace}
          </label>
          <input
            id={placeId}
            type="text"
            className={`${styles.box} ${styles.input}`}
            autoComplete="off"
            maxLength={OFFER_PICKUP_PLACE_MAX}
            placeholder={OFFER_COPY.pickupPlacePlaceholder}
            value={values.pickupPlace}
            onChange={(event) => update({ pickupPlace: event.target.value })}
          />
        </div>

        <DateTimeField
          label={OFFER_COPY.fieldDeadlineAt}
          value={values.deadlineAt}
          display={displayWith(formatMonthDay24h)}
          placeholder={OFFER_COPY.pickPlaceholder}
          onChange={(deadlineAt) => update({ deadlineAt })}
          invalid={deadlineMessage !== null}
          errorId={deadlineErrorId}
        />
        {deadlineMessage !== null && (
          <p id={deadlineErrorId} role="alert" className={styles.error}>
            {deadlineMessage}
          </p>
        )}

        <div className={styles.footer}>
          {hint && <p className={styles.hint}>{hint}</p>}
          {error && (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          )}
          <Button
            type="submit"
            variant="highlight"
            size="large"
            fullWidth
            loading={submitting}
            disabled={!check.canSubmit}
          >
            {OFFER_COPY.submit}
          </Button>
        </div>
      </form>

      {sent && (
        <Modal title={OFFER_COPY.sentTitle} describedBy={sentBodyId} onClose={goToList}>
          <p id={sentBodyId} className={styles.sentBody}>
            {OFFER_COPY.sentBody(sent.notifiedResidentCount)}
          </p>
          <Button variant="highlight" size="medium" onClick={goToList}>
            {OFFER_COPY.sentConfirm}
          </Button>
        </Modal>
      )}
    </>
  );
}
