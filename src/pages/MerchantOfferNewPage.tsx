import { useSearchParams } from 'react-router';
import { OfferForm } from '@/features/owner-offers/OfferForm';
import { OfferSummaryCard } from '@/features/owner-offers/OfferSummaryCard';
import { OFFER_COPY } from '@/features/owner-offers/copy';
import { isNoAreaError, useOfferContext } from '@/features/owner-offers/useOfferContext';
import { NoShopNotice } from '@/features/merchant-explore/NoShopNotice';
import { describeLoadError } from '@/features/resident-map/loadErrorText';
import { isNoShopError } from '@/services';
import { paths } from '@/shared/lib/paths';
import { AppBar } from '@/shared/ui/AppBar';
import { LogoLink } from '@/shared/ui/LogoLink';
import { Notice } from '@/shared/ui/Notice';
import styles from './MerchantOfferNewPage.module.css';

/**
 * 방문 판매 제안 작성 (Figma 45:542). 동네 상세의 "방문 판매 제안하기"(?area=동네)나 내 가게의 "내 제안 보내기"에서 들어온다.
 * 동네는 주소의 ?area=, 없으면 가게가 있는 동네이고 업종은 내 가게의 업종이다.
 * 보내면 알림 보낸 주민 수를 알리고 내 가게(제안 목록)로 간다. 데모 세션은 보내기가 막힌다.
 */
export function MerchantOfferNewPage() {
  const [params] = useSearchParams();
  const areaParam = params.get('area') || null;
  const context = useOfferContext(areaParam);

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <LogoLink />
        <AppBar
          title={OFFER_COPY.formTitle}
          fallbackTo={paths.merchantOffers(areaParam ?? undefined)}
        />
      </header>

      {context.status === 'loading' && <p role="status">{OFFER_COPY.loading}</p>}
      {context.status === 'error' &&
        (isNoShopError(context.error) ? (
          <NoShopNotice />
        ) : isNoAreaError(context.error) ? (
          <Notice title={OFFER_COPY.noAreaTitle}>{OFFER_COPY.noAreaBody}</Notice>
        ) : (
          <Notice title={OFFER_COPY.summaryFailedTitle}>{describeLoadError(context.error)}</Notice>
        ))}
      {context.status === 'success' && (
        <>
          <OfferSummaryCard detail={context.data.detail} />
          <OfferForm context={context.data} />
        </>
      )}
    </div>
  );
}
