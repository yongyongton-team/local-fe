import { MyRequestCard } from '@/features/my-requests/MyRequestCard';
import { ProgressSummaryCard } from '@/features/my-requests/ProgressSummaryCard';
import { describeRequestSummary } from '@/features/my-requests/requestProgress';
import { useMyRequests } from '@/features/my-requests/useMyRequests';
import { paths } from '@/shared/lib/paths';
import { LogoLink } from '@/shared/ui/LogoLink';
import { Notice } from '@/shared/ui/Notice';
import { SampleDataBadge } from '@/shared/ui/SampleDataBadge';
import { ShareButton } from '@/shared/ui/ShareButton';
import { Text } from '@/shared/ui/Text';
import type { MyRequest } from '@/types/domain';
import styles from './MyRequestsPage.module.css';

/**
 * 내 요청 (Figma node 2:1660). 가게 요청을 보낸 직후에도, 하단 내비로 들어와도 같은 화면이다.
 * 요청마다 동네 이름이 표시되므로 동네가 선택되지 않아도 보여준다(선택 안내를 띄우지 않는다).
 * 요약 카드는 가장 최근에 보낸 요청의 진행 상황이다. (추정)
 */
export function MyRequestsPage() {
  const state = useMyRequests();

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <LogoLink />
        <div className={styles.titleRow}>
          <Text as="h1" variant="title">
            내 요청
          </Text>
          {/* 디자인에 없는 임시 표시. 이 화면의 데이터는 개발용 목 데이터다. */}
          <SampleDataBadge />
        </div>
      </header>

      {state.status === 'loading' && <p role="status">불러오는 중이에요.</p>}
      {state.status === 'error' && (
        <Notice title="요청을 가져오지 못했어요">잠시 후 다시 시도해 주세요.</Notice>
      )}
      {state.status === 'success' && <Content items={state.data} />}
    </div>
  );
}

function Content({ items }: { items: MyRequest[] }) {
  const [latest] = items;

  if (!latest) {
    return (
      <Notice
        title="아직 보낸 요청이 없어요"
        action={{ to: paths.residentRequestNew, label: '가게 요청하기' }}
      >
        생겼으면 하는 가게를 요청하면 여기에서 진행 상황을 볼 수 있어요.
      </Notice>
    );
  }

  return (
    <>
      <div className={styles.summary}>
        <ProgressSummaryCard item={latest} />
      </div>
      <div className={styles.share}>
        <ShareButton
          label="이웃에게 알리기 (링크 공유)"
          text={describeRequestSummary(latest)}
          url={`${window.location.origin}/`}
        />
      </div>

      <section aria-labelledby="my-requests-list" className={styles.list}>
        <Text as="h2" variant="title" id="my-requests-list">
          내 요청
        </Text>
        <ul className={styles.cards}>
          {items.map((item) => (
            <li key={item.request.id}>
              <MyRequestCard item={item} />
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
