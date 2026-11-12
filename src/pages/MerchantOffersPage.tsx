import { useSearchParams } from 'react-router';
import { OfferCard } from '@/features/owner-offers/OfferCard';
import { OfferSummaryCard } from '@/features/owner-offers/OfferSummaryCard';
import { OFFER_COPY } from '@/features/owner-offers/copy';
import { isNoAreaError, useOfferContext } from '@/features/owner-offers/useOfferContext';
import { NoShopNotice } from '@/features/merchant-explore/NoShopNotice';
import { describeLoadError } from '@/features/resident-map/loadErrorText';
import { isNoShopError, offerService } from '@/services';
import { paths } from '@/shared/lib/paths';
import { useAsyncData } from '@/shared/lib/useAsyncData';
import { AppBar } from '@/shared/ui/AppBar';
import { LinkButton } from '@/shared/ui/Button';
import { LogoLink } from '@/shared/ui/LogoLink';
import { Notice } from '@/shared/ui/Notice';
import styles from './MerchantOffersPage.module.css';

const loadOffers = (signal: AbortSignal) => offerService.listOwnerOffers(signal);

/**
 * 내 가게(제안 목록) (Figma 45:584). 보낸 방문 판매 제안과 "{동} · {업종} 가게" 요약 카드를 보여준다.
 * 내 정보의 "내 가게"(/me/shop, 가게 등록·수정)와 다른 화면이다.
 * 요약 카드의 동네는 주소의 ?area= 이고 없으면 가게가 있는 동네다. 업종은 내 가게의 업종이다.
 * 목록이 비면 안내 문구와 "내 제안 보내기"만 보인다. 제안 상세·완료·취소는 이 화면에 없다(이후 작업).
 */
export function MerchantOffersPage() {
  const [params] = useSearchParams();
  const context = useOfferContext(params.get('area') || null);
  const offers = useAsyncData(loadOffers);

  const noShop = context.status === 'error' && isNoShopError(context.error);
  const isEmpty = offers.status === 'success' && offers.data.length === 0;
  const areaId = context.status === 'success' ? context.data.areaId : undefined;

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <LogoLink />
        <AppBar title={OFFER_COPY.listTitle} fallbackTo={paths.merchant} />
      </header>

      <div className={styles.body}>
        {context.status === 'loading' && <p role="status">{OFFER_COPY.loading}</p>}
        {context.status === 'error' &&
          (noShop ? (
            <NoShopNotice />
          ) : isNoAreaError(context.error) ? (
            <Notice title={OFFER_COPY.noAreaTitle}>{OFFER_COPY.noAreaBody}</Notice>
          ) : (
            <Notice title={OFFER_COPY.summaryFailedTitle}>
              {describeLoadError(context.error)}
            </Notice>
          ))}
        {context.status === 'success' && <OfferSummaryCard detail={context.data.detail} />}

        {!noShop && (
          <section className={styles.list} aria-label="보낸 제안">
            {offers.status === 'loading' && <p role="status">{OFFER_COPY.loading}</p>}
            {offers.status === 'error' && (
              <Notice title={OFFER_COPY.listFailedTitle}>{describeLoadError(offers.error)}</Notice>
            )}
            {isEmpty && <Notice title={OFFER_COPY.emptyTitle}>{OFFER_COPY.emptyBody}</Notice>}
            {offers.status === 'success' && !isEmpty && (
              <ul className={styles.cards}>
                {offers.data.map((offer) => (
                  <li key={offer.id}>
                    <OfferCard offer={offer} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>

      <footer className={styles.footer}>
        {areaId !== undefined && (
          <LinkButton
            to={paths.merchantOfferNew(areaId)}
            variant="highlight"
            size="large"
            fullWidth
          >
            {OFFER_COPY.sendOffer}
          </LinkButton>
        )}
        {/* 목록이 비면 안내와 "내 제안 보내기"만 보인다(요청 모아 보기로 버튼은 뺀다). */}
        {!isEmpty && (
          <LinkButton to={paths.merchant} variant="neutral" size="large" fullWidth>
            {OFFER_COPY.backToRequests}
          </LinkButton>
        )}
      </footer>
    </div>
  );
}
