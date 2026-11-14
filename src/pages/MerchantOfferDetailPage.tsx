import { useRef, useState } from 'react';
import { useParams } from 'react-router';
import { OFFER_COPY } from '@/features/owner-offers/copy';
import { OfferDetailCard } from '@/features/owner-offers/OfferDetailCard';
import { describeOfferActionError } from '@/features/owner-offers/offerActionError';
import { OfferStatusBadge } from '@/features/owner-offers/OfferStatusBadge';
import {
  availableActions,
  buildDeadlineText,
  buildDetailPlace,
} from '@/features/owner-offers/offerView';
import { useOfferDetail, type OfferDetailData } from '@/features/owner-offers/useOfferDetail';
import { describeLoadError } from '@/features/resident-map/loadErrorText';
import { offerService } from '@/services';
import { paths } from '@/shared/lib/paths';
import { AppBar } from '@/shared/ui/AppBar';
import { Button } from '@/shared/ui/Button';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { LogoLink } from '@/shared/ui/LogoLink';
import { Notice } from '@/shared/ui/Notice';
import type { OwnerOffer } from '@/types/domain';
import styles from './MerchantOfferDetailPage.module.css';

/**
 * 제안 상세(Figma 66:472): 상태 줄(뱃지 + 마감), 제목, "동네 · 업종", 예약 현황 카드, 하단 「판매 끝」「제안 취소」.
 * 제안은 내 제안 목록에서 :offerId 로 찾는다(단건 조회가 없다). 못 찾으면 "찾을 수 없는 제안" 안내와 목록 링크가 보인다.
 * 버튼은 상태에 따라 보인다: 모집 중(OPEN)은 「제안 취소」만, 확정(CONFIRMED)은 「판매 끝」+「제안 취소」, 그 밖은 읽기 전용.
 * 판매 끝·제안 취소는 확인 팝업을 거치고, 성공하면 응답으로 화면이 바로 새 상태가 된다. 데모 세션도 막지 않는다.
 */
export function MerchantOfferDetailPage() {
  const { offerId } = useParams();
  const state = useOfferDetail(offerId);

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <LogoLink />
        <AppBar title={OFFER_COPY.detailTitle} fallbackTo={paths.merchantOffers()} />
      </header>

      {state.status === 'loading' && <p role="status">{OFFER_COPY.loading}</p>}
      {state.status === 'error' && (
        <Notice title={OFFER_COPY.detailFailedTitle}>{describeLoadError(state.error)}</Notice>
      )}
      {state.status === 'success' &&
        (state.data === null ? (
          <OfferNotFound />
        ) : (
          // 다른 제안으로 바뀌면 화면 상태(팝업·오류)를 새로 시작한다.
          <OfferDetail key={state.data.offer.id} initial={state.data} />
        ))}
    </div>
  );
}

function OfferNotFound() {
  return (
    <Notice
      title={OFFER_COPY.detailNotFoundTitle}
      action={{ to: paths.merchantOffers(), label: OFFER_COPY.detailNotFoundAction }}
    >
      {OFFER_COPY.detailNotFoundBody}
    </Notice>
  );
}

type Pending = 'complete' | 'cancel';

function OfferDetail({ initial }: { initial: OfferDetailData }) {
  const { categoryLabel } = initial;
  const [offer, setOffer] = useState<OwnerOffer>(initial.offer);
  const [dialog, setDialog] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 처리 중 다른 곳에서 지워졌거나(404) 다시 불러왔더니 없어진 경우
  const [gone, setGone] = useState(false);
  // state 갱신보다 빠른 연타도 막는다.
  const busyRef = useRef(false);

  const actions = availableActions(offer.status);
  const deadline = buildDeadlineText(offer);
  const place = buildDetailPlace(offer, categoryLabel);

  async function run(kind: Pending) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const next =
        kind === 'complete'
          ? await offerService.completeOffer(offer.id)
          : await offerService.cancelOffer(offer.id);
      // 응답(갱신된 제안)으로 뱃지·버튼·막대·안내 문구가 바로 바뀐다. 목록은 다시 열 때 서버에서 새로 읽는다.
      setOffer(next);
      setDialog(null);
    } catch (e) {
      setDialog(null);
      const failure = describeOfferActionError(e);
      if (failure.kind === 'notFound') {
        setGone(true);
      } else {
        setError(failure.message);
        if (failure.kind === 'closed') {
          // 마감 시각이 지나 상태가 바뀐 경우가 흔하다. 서버 상태로 다시 불러와 화면을 맞춘다(실패하면 지금 화면 그대로).
          try {
            const fresh = await offerService.getOwnerOffer(offer.id);
            if (fresh) setOffer(fresh);
            else setGone(true);
          } catch {
            // 다시 불러오지 못해도 안내 문구는 이미 보인다.
          }
        }
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  if (gone) return <OfferNotFound />;

  const dialogCopy =
    dialog === 'complete'
      ? OFFER_COPY.completeDialog
      : dialog === 'cancel'
        ? OFFER_COPY.cancelDialog
        : null;

  return (
    <>
      <div className={styles.body}>
        <div className={styles.statusRow}>
          <OfferStatusBadge offer={offer} />
          {deadline && <span className={styles.deadline}>{deadline}</span>}
        </div>
        <h2 className={styles.title}>{offer.title}</h2>
        {place && <p className={styles.place}>{place}</p>}
        <OfferDetailCard offer={offer} />
      </div>

      <footer className={styles.footer}>
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
        {actions.complete && (
          <Button
            variant="highlight"
            size="large"
            fullWidth
            disabled={busy}
            onClick={() => setDialog('complete')}
          >
            {OFFER_COPY.completeAction}
          </Button>
        )}
        {actions.cancel && (
          <Button
            variant="neutral"
            size="large"
            fullWidth
            disabled={busy}
            onClick={() => setDialog('cancel')}
          >
            {OFFER_COPY.cancelAction}
          </Button>
        )}
      </footer>

      {dialog && dialogCopy && (
        <ConfirmDialog
          title={dialogCopy.title}
          confirmLabel={dialogCopy.confirm}
          cancelLabel={dialogCopy.cancel}
          busy={busy}
          onConfirm={() => void run(dialog)}
          onCancel={() => setDialog(null)}
        >
          {dialogCopy.body}
        </ConfirmDialog>
      )}
    </>
  );
}
