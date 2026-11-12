import { useParams } from 'react-router';
import {
  buildConditionRows,
  buildDetailTitle,
  buildVisitTimeRows,
} from '@/features/merchant-area/areaDetailView';
import { BarSection } from '@/features/merchant-area/BarSection';
import { OneLineSummary } from '@/features/merchant-area/OneLineSummary';
import { useAreaDetail } from '@/features/merchant-area/useAreaDetail';
import { NoShopNotice } from '@/features/merchant-explore/NoShopNotice';
import { describeLoadError } from '@/features/resident-map/loadErrorText';
import { isNoShopError, merchantService } from '@/services';
import { paths } from '@/shared/lib/paths';
import { LogoLink } from '@/shared/ui/LogoLink';
import { AppBar } from '@/shared/ui/AppBar';
import { LinkButton } from '@/shared/ui/Button';
import { Notice } from '@/shared/ui/Notice';
import { StatCards } from '@/shared/ui/StatCards';
import styles from './MerchantAreaDetailPage.module.css';

/** 로딩·오류·찾을 수 없음 화면의 앱바 제목 */
const FALLBACK_TITLE = '동네 수요';

/**
 * 사장님용 동네 수요 상세 (Figma node 2:1947 구성동 / 2:2159 보정동 / 2:2227 마북동: 값만 다른 같은 화면).
 * :areaId 는 동네 id 다. 역할·동네 선택이 없어도 렌더링한다(접근 권한이 아니다).
 * 하단 내비게이션은 없다. "방문 판매 제안하기"는 이 동네에 대한 방문 판매 제안 작성 화면으로 이동한다.
 */
export function MerchantAreaDetailPage() {
  const { areaId } = useParams();
  const state = useAreaDetail(areaId);

  const title =
    state.status === 'success' && state.data ? buildDetailTitle(state.data.detail) : FALLBACK_TITLE;

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <LogoLink />
        <AppBar title={title} fallbackTo={paths.merchant} />
      </header>

      {state.status === 'loading' && <p role="status">불러오는 중이에요.</p>}
      {state.status === 'error' &&
        (isNoShopError(state.error) ? (
          <NoShopNotice />
        ) : (
          <Notice title="데이터를 가져오지 못했어요">{describeLoadError(state.error)}</Notice>
        ))}
      {state.status === 'success' && !state.data && (
        <Notice
          title="찾을 수 없는 동네예요"
          action={{ to: paths.merchant, label: '동네 목록으로' }}
        >
          주소가 잘못되었거나 아직 데이터가 없는 동네예요.
        </Notice>
      )}
      {state.status === 'success' && state.data && (
        <>
          <StatCards
            items={[
              { label: '요청한 주민', value: `${state.data.detail.requestCount}명` },
              {
                label: '근처 같은 업종',
                value: `${state.data.detail.nearbySameCategoryCount}곳`,
              },
            ]}
          />
          <div className={styles.sections}>
            <BarSection title="주민이 원하는 조건" rows={buildConditionRows(state.data.detail)} />
            <BarSection title="가기 좋은 시간" rows={buildVisitTimeRows(state.data.detail)} />
          </div>
          <div className={styles.summary}>
            <OneLineSummary summary={state.data.summary} remote={merchantService.remote} />
          </div>
          <footer className={styles.footer}>
            <LinkButton
              to={paths.merchantOfferNew(state.data.detail.neighborhood.id)}
              variant="highlight"
              size="large"
              fullWidth
            >
              방문 판매 제안하기
            </LinkButton>
          </footer>
        </>
      )}
    </div>
  );
}
