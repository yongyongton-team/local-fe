import { useRef, useState } from 'react';
import { useParams } from 'react-router';
import { OfferStatusBadge } from '@/features/owner-offers/OfferStatusBadge';
import { RESIDENT_OFFER_COPY } from '@/features/resident-offers/copy';
import {
  buildDeadlineText,
  buildRecruitment,
  buildResidentRows,
  clampQuantity,
  formatOrderAmount,
  resolveOrderMode,
} from '@/features/resident-offers/offerView';
import { describeOrderError } from '@/features/resident-offers/orderActionError';
import { QuantityStepper } from '@/features/resident-offers/QuantityStepper';
import { useResidentOffer } from '@/features/resident-offers/useResidentOffer';
import { describeLoadError } from '@/features/resident-map/loadErrorText';
import { myRequestService, orderService } from '@/services';
import { paths } from '@/shared/lib/paths';
import { AppBar } from '@/shared/ui/AppBar';
import { Button } from '@/shared/ui/Button';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { LogoLink } from '@/shared/ui/LogoLink';
import { Notice } from '@/shared/ui/Notice';
import type { ResidentOffer } from '@/types/domain';
import styles from './ResidentOfferDetailPage.module.css';

/**
 * 주민 제안 상세(Figma 66:518): 상태 줄(뱃지 + 마감), "사장님 / 제안 제목", 가격·받는 날·마감·받는 곳, 「모집 현황」 막대, 수량, 하단 버튼.
 * 제안은 내 요청 목록의 offers[] 에서 :offerId 로 찾는다(단건 조회가 없다). 못 찾으면(사장님이 취소하면 서버 응답에서 빠진다)
 * "취소되었거나 사라진 제안" 안내와 내 요청 링크가 보인다. 제안 설명 문장은 서버가 주지 않아 그리지 않는다.
 * 버튼은 상태에 따라 보인다: 모집 중(OPEN)에 주문이 없으면 「선주문하기」, 예약(RESERVED)이 있으면 「예약 취소하기」(확인 팝업),
 * 그 밖의 상태는 버튼 없이 안내 문구다. 성공하면 응답으로 화면이 바로 바뀌고 이어서 서버 값으로 조용히 맞춘다.
 */
export function ResidentOfferDetailPage() {
  const { offerId } = useParams();
  const state = useResidentOffer(offerId);

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <LogoLink />
        <AppBar title={RESIDENT_OFFER_COPY.title} fallbackTo={paths.residentRequests} />
      </header>

      {state.status === 'loading' && <p role="status">{RESIDENT_OFFER_COPY.loading}</p>}
      {state.status === 'error' && (
        <Notice title={RESIDENT_OFFER_COPY.failedTitle}>{describeLoadError(state.error)}</Notice>
      )}
      {state.status === 'success' &&
        (state.data === null ? (
          <OfferGone />
        ) : (
          // 다른 제안으로 바뀌면 화면 상태(수량·팝업·오류)를 새로 시작한다.
          <OfferDetail key={state.data.id} initial={state.data} />
        ))}
    </div>
  );
}

function OfferGone() {
  return (
    <Notice
      title={RESIDENT_OFFER_COPY.notFoundTitle}
      action={{ to: paths.residentRequests, label: RESIDENT_OFFER_COPY.notFoundAction }}
    />
  );
}

function OfferDetail({ initial }: { initial: ResidentOffer }) {
  const [offer, setOffer] = useState<ResidentOffer>(initial);
  const [quantity, setQuantity] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 처리 중 사라졌거나(404) 다시 불러왔더니 없어진 경우
  const [gone, setGone] = useState(false);
  // state 갱신보다 빠른 연타도 막는다.
  const busyRef = useRef(false);
  // 서버 값으로 맞추는 조회의 결과가 더 새 처리보다 늦게 오면 버린다.
  const syncSeq = useRef(0);

  const mode = resolveOrderMode(offer);
  const recruitment = buildRecruitment(offer);
  const rows = buildResidentRows(offer);

  /** 서버 상태로 화면을 맞춘다. 실패하면 지금 화면 그대로 둔다(이미 안내 문구가 보인다). */
  async function sync(seq: number) {
    try {
      const fresh = await myRequestService.getResidentOffer(offer.id);
      if (seq !== syncSeq.current) return;
      if (fresh) setOffer(fresh);
      else setGone(true);
    } catch {
      // 다시 불러오지 못해도 처리 결과나 오류 문구는 이미 보인다.
    }
  }

  async function run(kind: 'order' | 'cancel') {
    if (busyRef.current) return;
    busyRef.current = true;
    const seq = ++syncSeq.current;
    setBusy(true);
    setError(null);
    let succeeded = false;
    try {
      if (kind === 'order') {
        const result = await orderService.createOrder(offer.id, quantity);
        // 응답으로 내 주문과 예약 수를 바로 바꾼다.
        setOffer((current) => ({
          ...current,
          myOrder: result.order,
          orderCount: result.orderCount,
          minOrders: result.minOrders,
        }));
      } else {
        const order = offer.myOrder;
        if (!order) return;
        await orderService.cancelOrder(order.id);
        // 204 는 본문이 없다. 내 주문을 지우고 예약 수에서 그 수량을 뺀다.
        setOffer((current) => ({
          ...current,
          myOrder: null,
          orderCount: Math.max(0, current.orderCount - order.quantity),
        }));
        setQuantity(1);
      }
      succeeded = true;
      setDialogOpen(false);
    } catch (e) {
      setDialogOpen(false);
      const failure = describeOrderError(e);
      if (failure.kind === 'notFound') {
        setGone(true);
      } else {
        setError(failure.message);
        if (
          failure.kind === 'closed' ||
          failure.kind === 'alreadyOrdered' ||
          failure.kind === 'unknown'
        ) {
          // 마감됐거나 이미 주문한 경우가 흔하다. 서버 상태로 다시 불러와 화면을 맞춘다.
          await sync(seq);
        }
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
    // 성공한 뒤에는 조용히 서버 값과 맞춘다(기다리지 않는다).
    if (succeeded) void sync(seq);
  }

  if (gone) return <OfferGone />;

  return (
    <>
      <div className={styles.body}>
        <div className={styles.statusRow}>
          <OfferStatusBadge offer={offer} />
          <span className={styles.deadline}>{buildDeadlineText(offer)}</span>
        </div>
        <h2 className={styles.title}>{RESIDENT_OFFER_COPY.heading(offer.shopName, offer.title)}</h2>

        {rows.length > 0 && (
          <dl className={styles.rows}>
            {rows.map((row) => (
              <div key={row.key} className={styles.row}>
                <dt className={styles.label}>{row.label}</dt>
                <dd className={styles.value}>{row.value}</dd>
              </div>
            ))}
          </dl>
        )}

        <section className={styles.section} aria-labelledby="recruit-title">
          <h3 id="recruit-title" className={styles.sectionTitle}>
            {RESIDENT_OFFER_COPY.recruitTitle}
          </h3>
          <div
            role="progressbar"
            aria-labelledby="recruit-title"
            aria-valuetext={recruitment.text}
            aria-valuemin={0}
            aria-valuemax={recruitment.valueMax}
            aria-valuenow={Math.min(recruitment.valueNow, recruitment.valueMax)}
            className={styles.track}
          >
            <div className={styles.fill} style={{ width: `${recruitment.ratio * 100}%` }} />
          </div>
          <p className={styles.recruitText}>{recruitment.text}</p>
        </section>

        <section className={styles.section}>
          {mode.kind === 'order' && (
            <div className={styles.orderRow} role="group" aria-labelledby="quantity-label">
              <h3 id="quantity-label" className={styles.sectionTitle}>
                {RESIDENT_OFFER_COPY.quantityLabel}
              </h3>
              <QuantityStepper
                value={quantity}
                disabled={busy}
                onChange={(value) => setQuantity(clampQuantity(value))}
              />
            </div>
          )}
          {mode.kind === 'reserved' && (
            <p className={styles.note}>{RESIDENT_OFFER_COPY.myOrder(mode.order.quantity)}</p>
          )}
          {mode.kind === 'readOnly' && (
            <>
              {mode.reservedQuantity !== undefined && (
                <p className={styles.note}>{RESIDENT_OFFER_COPY.myOrder(mode.reservedQuantity)}</p>
              )}
              {mode.note && <p className={styles.note}>{mode.note}</p>}
            </>
          )}
        </section>
      </div>

      <footer className={styles.footer}>
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
        {mode.kind === 'order' && (
          <Button
            variant="highlight"
            size="large"
            fullWidth
            loading={busy}
            onClick={() => void run('order')}
          >
            {RESIDENT_OFFER_COPY.orderAction(formatOrderAmount(offer.price, quantity))}
          </Button>
        )}
        {mode.kind === 'reserved' && (
          <Button
            variant="highlight"
            size="large"
            fullWidth
            disabled={busy}
            onClick={() => setDialogOpen(true)}
          >
            {RESIDENT_OFFER_COPY.cancelAction}
          </Button>
        )}
      </footer>

      {dialogOpen && (
        <ConfirmDialog
          title={RESIDENT_OFFER_COPY.cancelDialog.title}
          confirmLabel={RESIDENT_OFFER_COPY.cancelDialog.confirm}
          cancelLabel={RESIDENT_OFFER_COPY.cancelDialog.cancel}
          busy={busy}
          onConfirm={() => void run('cancel')}
          onCancel={() => setDialogOpen(false)}
        >
          {RESIDENT_OFFER_COPY.cancelDialog.body}
        </ConfirmDialog>
      )}
    </>
  );
}
