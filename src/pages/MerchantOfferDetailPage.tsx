import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { OFFER_COPY } from '@/features/owner-offers/copy';
import { OfferDetailCard } from '@/features/owner-offers/OfferDetailCard';
import { NotifiedResidents, OfferSentBanner } from '@/features/owner-offers/OfferSentBanner';
import { OfferStatusCard } from '@/features/owner-offers/OfferStatusCard';
import { describeOfferActionError } from '@/features/owner-offers/offerActionError';
import { OfferStatusBadge } from '@/features/owner-offers/OfferStatusBadge';
import {
  availableActions,
  buildDeadlineText,
  buildSubtitle,
} from '@/features/owner-offers/offerView';
import { useOfferDetail, type OfferDetailData } from '@/features/owner-offers/useOfferDetail';
import { describeLoadError } from '@/features/resident-map/loadErrorText';
import { offerService } from '@/services';
import { paths } from '@/shared/lib/paths';
import { AppBar } from '@/shared/ui/AppBar';
import { Button, LinkButton } from '@/shared/ui/Button';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { LogoLink } from '@/shared/ui/LogoLink';
import { Notice } from '@/shared/ui/Notice';
import type { OwnerOffer } from '@/types/domain';
import styles from './MerchantOfferDetailPage.module.css';

/**
 * 제안을 막 보낸 직후 작성 화면이 라우터 state 로 넘기는 값. 배너와 "{N}명의 주민에게 알렸어요"를 보이는 데만 쓴다.
 * 이 state 는 처음 읽은 뒤 지운다(새로고침해도 브라우저가 history state 를 되살리므로 배너가 다시 뜨지 않게).
 */
export interface JustSentState {
  justSent: true;
  notifiedResidentCount?: number;
}

function readJustSent(state: unknown): JustSentState | null {
  if (typeof state !== 'object' || state === null || !('justSent' in state)) return null;
  if (state.justSent !== true) return null;
  const n = 'notifiedResidentCount' in state ? state.notifiedResidentCount : undefined;
  return {
    justSent: true,
    ...(typeof n === 'number' && Number.isInteger(n) && n >= 0 && { notifiedResidentCount: n }),
  };
}

/**
 * 보낸 제안 상세(Figma 79:2488 모집 중·79:2449 확정·79:2418 완료·79:2354 전송 결과):
 * 상태 줄(뱃지 + 마감), "가게 이름 / 제안 제목", 부제(설명 또는 상태 문구), 가격·받는 날·마감·받는 곳, 예약 막대, 상태 카드, 하단 버튼.
 * 제안은 내 제안 목록에서 :offerId 로 찾는다(단건 조회가 없다). 못 찾으면 "찾을 수 없는 제안" 안내와 목록 링크가 보인다.
 * 버튼은 상태에 따라 보인다: 모집 중(OPEN)은 「제안 취소」, 확정(CONFIRMED)은 「수령 완료 처리」+「제안 취소」,
 * 그 밖(마감·완료·취소)은 읽기 전용이라 「보낸 제안으로」만 있다.
 * 수령 완료 처리·제안 취소는 확인 팝업을 거치고, 성공하면 응답으로 화면이 바로 새 상태가 된다. 데모 세션도 막지 않는다.
 * 제안을 막 보낸 뒤(작성 화면이 넘긴 state)에는 맨 위에 "제안을 보냈어요!" 배너와 알린 주민 수가 함께 보인다.
 */
export function MerchantOfferDetailPage() {
  const { offerId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  // 처음 한 번만 읽는다. 아래 effect 가 state 를 지워도 이 화면에서는 배너를 유지한다.
  const [justSent] = useState(() => readJustSent(location.state));
  const state = useOfferDetail(offerId, justSent !== null);

  useEffect(() => {
    if (justSent) {
      void navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
    }
    // 처음 한 번만 지운다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          <OfferDetail key={state.data.offer.id} initial={state.data} justSent={justSent} />
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

function OfferDetail({
  initial,
  justSent,
}: {
  initial: OfferDetailData;
  justSent: JustSentState | null;
}) {
  const { shopName } = initial;
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
  const subtitle = buildSubtitle(offer);

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
        {justSent && <OfferSentBanner />}
        <div className={styles.statusRow}>
          <OfferStatusBadge offer={offer} />
          {deadline && <span className={styles.deadline}>{deadline}</span>}
        </div>
        <h2 className={styles.title}>{OFFER_COPY.heading(shopName, offer.title)}</h2>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        <OfferDetailCard offer={offer} />
        <OfferStatusCard offer={offer} />
        {justSent?.notifiedResidentCount !== undefined && (
          <NotifiedResidents count={justSent.notifiedResidentCount} />
        )}
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
          // 모집 중에는 이 버튼 하나뿐이라 기본(라임) 버튼이고, 확정에서는 「수령 완료 처리」 아래의 보조(회색) 버튼이다.
          <Button
            variant={actions.complete ? 'neutral' : 'highlight'}
            size="large"
            fullWidth
            disabled={busy}
            onClick={() => setDialog('cancel')}
          >
            {OFFER_COPY.cancelAction}
          </Button>
        )}
        {actions.toList && (
          <LinkButton to={paths.merchantOffers()} variant="highlight" size="large" fullWidth>
            {OFFER_COPY.backToList}
          </LinkButton>
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
