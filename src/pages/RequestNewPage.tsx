import { NeighborhoodNotice } from '@/features/selection/NeighborhoodNotice';
import { useSelection } from '@/features/selection/SelectionContext';
import { paths } from '@/shared/lib/paths';
import { Button } from '@/shared/ui/Button';
import { Page } from '@/shared/ui/Page';
import { Text } from '@/shared/ui/Text';
import { TextArea } from '@/shared/ui/TextArea';
import styles from './RequestNewPage.module.css';

/** 가게 요청 작성. 제출과 AI 정리는 백엔드 연동 후 구현하므로 지금은 입력 골격만 둔다. */
export function RequestNewPage() {
  const { neighborhood } = useSelection();

  return (
    <Page title="가게 요청 작성" backTo={paths.resident}>
      {neighborhood ? (
        <form className={styles.form} onSubmit={(event) => event.preventDefault()}>
          <Text>
            위치: {neighborhood.district} {neighborhood.name} (동 단위로만 저장해요)
          </Text>
          <TextArea
            label="원하는 가게와 조건"
            description="어떤 가게가 생기면 좋을지 자유롭게 적어 주세요."
            placeholder="예: 밤 10시까지 하는 과일가게요."
          />
          <Button type="submit" disabled fullWidth>
            요청 보내기
          </Button>
          <Text variant="caption">요청 제출은 서버 연동 후 사용할 수 있어요.</Text>
        </form>
      ) : (
        <NeighborhoodNotice />
      )}
    </Page>
  );
}
