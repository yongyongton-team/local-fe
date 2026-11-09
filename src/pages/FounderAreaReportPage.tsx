import type { ReactNode } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { CATEGORY_PARAM } from '@/features/founder-explore/constants';
import { resolveCategoryId } from '@/features/founder-explore/locationRows';
import { useCategories } from '@/features/founder-explore/useFounderExplore';
import { buildReportStats, buildReportTitle } from '@/features/founder-report/reportView';
import { SourcesSection } from '@/features/founder-report/SourcesSection';
import { useAreaReport, useReportSentence } from '@/features/founder-report/useAreaReport';
import { WhyCard } from '@/features/founder-report/WhyCard';
import { describeLoadError } from '@/features/resident-map/loadErrorText';
import { founderService } from '@/services';
import { paths } from '@/shared/lib/paths';
import { LogoLink } from '@/shared/ui/LogoLink';
import { AppBar } from '@/shared/ui/AppBar';
import { Notice } from '@/shared/ui/Notice';
import { ShareButton } from '@/shared/ui/ShareButton';
import { StatCards } from '@/shared/ui/StatCards';
import type { AreaReport } from '@/types/domain';
import styles from './FounderAreaReportPage.module.css';

/** 로딩·오류·찾을 수 없음 화면의 앱바 제목 */
const FALLBACK_TITLE = '동네 리포트';

/**
 * 예비 창업자용 동네 리포트 (Figma node 2:2015 구성동 / 2:2063 보정동 / 2:2111 마북동: 값만 다른 같은 화면).
 * 리포트는 (동네, 업종) 단위이고, 업종은 입지 찾기 링크가 붙인 ?category= 로 받는다(없거나 올바르지 않으면 기본 업종).
 * 역할·동네 선택이 없어도 렌더링한다(접근 권한이 아니다). 하단 내비게이션은 없다.
 */
export function FounderAreaReportPage() {
  const categories = useCategories();

  if (categories.status === 'success') {
    return (
      <ReportScreen
        categories={categories.data.categories}
        defaultCategoryId={categories.data.defaultCategoryId}
      />
    );
  }
  return (
    <Shell title={FALLBACK_TITLE} backTo={paths.founderExplore()}>
      {categories.status === 'loading' ? (
        <p role="status">불러오는 중이에요.</p>
      ) : (
        <Notice title="업종을 가져오지 못했어요">{describeLoadError(categories.error)}</Notice>
      )}
    </Shell>
  );
}

function ReportScreen({
  categories,
  defaultCategoryId,
}: {
  categories: Parameters<typeof resolveCategoryId>[1];
  defaultCategoryId: string;
}) {
  const { areaId } = useParams();
  const [params] = useSearchParams();
  const categoryId = resolveCategoryId(params.get(CATEGORY_PARAM), categories, defaultCategoryId);
  // 뒤로 가기(직접 진입)와 안내 링크는 선택한 업종을 유지한 입지 찾기로 간다.
  const backTo = paths.founderExplore(categoryId);
  const state = useAreaReport(areaId, categoryId);

  if (state.status === 'loading') {
    return (
      <Shell title={FALLBACK_TITLE} backTo={backTo}>
        <p role="status">불러오는 중이에요.</p>
      </Shell>
    );
  }
  if (state.status === 'error') {
    return (
      <Shell title={FALLBACK_TITLE} backTo={backTo}>
        <Notice title="데이터를 가져오지 못했어요">{describeLoadError(state.error)}</Notice>
      </Shell>
    );
  }
  if (!state.data || !areaId) {
    return (
      <Shell title={FALLBACK_TITLE} backTo={backTo}>
        <Notice title="찾을 수 없는 동네예요" action={{ to: backTo, label: '입지 찾기로' }}>
          주소가 잘못되었거나 아직 데이터가 없는 동네예요.
        </Notice>
      </Shell>
    );
  }
  return (
    <ReportContent report={state.data} areaId={areaId} categoryId={categoryId} backTo={backTo} />
  );
}

function ReportContent({
  report,
  areaId,
  categoryId,
  backTo,
}: {
  report: AreaReport;
  areaId: string;
  categoryId: string;
  backTo: string;
}) {
  const sentence = useReportSentence(report);
  const title = buildReportTitle(report);
  // 공유 문구는 "왜 이 동네인가요?" 문장이다. 아직 만들어지지 않았으면 제목을 쓴다.
  const shareText = sentence.status === 'success' ? sentence.data : title;

  return (
    <Shell title={title} backTo={backTo}>
      <div className={styles.stats}>
        <StatCards items={buildReportStats(report)} />
      </div>
      <div className={styles.why}>
        <WhyCard sentence={sentence} remote={founderService.remote} by={report.explanation?.by} />
      </div>
      <div className={styles.sources}>
        <SourcesSection sources={report.sources} remote={founderService.remote} />
      </div>
      <footer className={styles.footer}>
        <ShareButton
          label="리포트 공유하기"
          text={shareText}
          url={`${window.location.origin}${paths.founderAreaReport(areaId, categoryId)}`}
        />
      </footer>
    </Shell>
  );
}

function Shell({
  title,
  backTo,
  children,
}: {
  title: string;
  backTo: string;
  children: ReactNode;
}) {
  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <LogoLink />
        <AppBar title={title} fallbackTo={backTo} />
      </header>
      {children}
    </div>
  );
}
