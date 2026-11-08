import { useParams } from 'react-router';
import {
  buildConditionRows,
  buildDetailTitle,
  buildVisitTimeRows,
} from '@/features/merchant-area/areaDetailView';
import { BarSection } from '@/features/merchant-area/BarSection';
import { DecisionCallout } from '@/features/merchant-area/DecisionCallout';
import { OneLineSummary } from '@/features/merchant-area/OneLineSummary';
import { SummaryStats } from '@/features/merchant-area/SummaryStats';
import { useAreaDetail } from '@/features/merchant-area/useAreaDetail';
import logo from '@/shared/assets/logo.png';
import { paths } from '@/shared/lib/paths';
import { AppBar } from '@/shared/ui/AppBar';
import { Notice } from '@/shared/ui/Notice';
import styles from './MerchantAreaDetailPage.module.css';

/** 로딩·오류·찾을 수 없음 화면의 앱바 제목 */
const FALLBACK_TITLE = '동네 수요';

/**
 * 사장님용 동네 수요 상세 (Figma node 2:1947 구성동 / 2:2159 보정동 / 2:2227 마북동: 값만 다른 같은 화면).
 * :areaId 는 동네 id 다. 역할·동네 선택이 없어도 렌더링한다(접근 권한이 아니다).
 * 하단 내비게이션은 없다. "방문 판매 제안하기" 이후 화면은 정해지지 않아 버튼은 동작이 없다.
 */
export function MerchantAreaDetailPage() {
  const { areaId } = useParams();
  const state = useAreaDetail(areaId);

  const title =
    state.status === 'success' && state.data ? buildDetailTitle(state.data.detail) : FALLBACK_TITLE;

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <img src={logo} alt="생기면 갈게요" width={129} height={43} className={styles.logo} />
        <AppBar title={title} fallbackTo={paths.merchant} />
      </header>

      {state.status === 'loading' && <p role="status">불러오는 중이에요.</p>}
      {state.status === 'error' && (
        <Notice title="데이터를 가져오지 못했어요">잠시 후 다시 시도해 주세요.</Notice>
      )}
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
          <SummaryStats
            requestCount={state.data.detail.requestCount}
            nearbySameCategoryCount={state.data.detail.nearbySameCategoryCount}
          />
          <div className={styles.sections}>
            <BarSection title="주민이 원하는 조건" rows={buildConditionRows(state.data.detail)} />
            <BarSection title="가기 좋은 시간" rows={buildVisitTimeRows(state.data.detail)} />
          </div>
          <div className={styles.summary}>
            <OneLineSummary summary={state.data.summary} />
          </div>
          <footer className={styles.footer}>
            <DecisionCallout />
          </footer>
        </>
      )}
    </div>
  );
}
