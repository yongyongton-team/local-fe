import { useId, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import {
  authService,
  DEMO_WRITE_BLOCKED_MESSAGE,
  describeApiError,
  offerService,
} from '@/services';
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
  firstHint,
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

  const check = checkOfferForm(values);
  const hint = dirty ? firstHint(check) : null;

  function update(patch: Partial<OfferFormValues>) {
    setValues((current) => ({ ...current, ...patch }));
    setDirty(true);
    setError(null);
  }

  const goToList = () => void navigate(paths.merchantOffers(context.areaId), { replace: true });

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submittingRef.current || !check.canSubmit) return;
    const pickupAt = parseKstInput(values.pickupAt);
    const deadlineAt = parseKstInput(values.deadlineAt);
    if (!pickupAt || !deadlineAt) return;
    setError(null);

    // 데모 세션(공유 계정)은 제안을 만들지 않는다(POST /offers 없음). 서비스에도 같은 방어가 있다.
    if (authService.isDemoSession()) {
      setError(DEMO_WRITE_BLOCKED_MESSAGE);
      return;
    }

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
      setError(describeApiError(e));
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
                onChange={(event) => update({ price: sanitizePrice(event.target.value) })}
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
          invalid={check.deadlineNotBeforePickup}
          errorId={deadlineErrorId}
        />
        {check.deadlineNotBeforePickup && (
          <p id={deadlineErrorId} role="alert" className={styles.error}>
            {OFFER_COPY.deadlineAfterPickup}
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
