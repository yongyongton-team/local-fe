import { useEffect, useState, type ReactNode } from 'react';
import { MobileLayout } from '@/shared/layouts/MobileLayout';
import { BottomNav } from '@/shared/ui/BottomNav';
import { Button, LinkButton } from '@/shared/ui/Button';
import { Card, CardLink } from '@/shared/ui/Card';
import { ChipGroup } from '@/shared/ui/ChipGroup';
import { ChoiceChip } from '@/shared/ui/ChoiceChip';
import { IconButton } from '@/shared/ui/IconButton';
import { ArrowLeftIcon } from '@/shared/ui/icons';
import { Text } from '@/shared/ui/Text';
import { TextArea } from '@/shared/ui/TextArea';
import styles from './DesignSystemPage.module.css';

/*
 * 개발 환경 전용 페이지 (app/devRoutes.tsx 참고). 프로덕션 번들에는 포함되지 않는다.
 * 토큰 값은 HEX 를 중복하지 않도록 실제 CSS 변수의 계산값을 읽어서 보여준다.
 */

type Source = 'ds' | 'screen' | 'temp';

const SOURCE_LABEL: Record<Source, string> = {
  ds: '디자인 시스템 명시',
  screen: '화면에서 확인',
  temp: '임시',
};

function SourceTag({ source }: { source: Source }) {
  return <span className={`${styles.tag} ${styles[source]}`}>{SOURCE_LABEL[source]}</span>;
}

/** 현재 적용된 CSS 변수의 계산값. 렌더링 시점에 한 번 읽는다. */
function TokenValue({ token }: { token: string }) {
  const [value] = useState(() =>
    getComputedStyle(document.documentElement).getPropertyValue(token).trim(),
  );
  return <code>{value || '(없음)'}</code>;
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className={styles.section}>
      <Text as="h2" variant="title" id={id}>
        {title}
      </Text>
      {children}
    </section>
  );
}

function Sub({ children }: { children: ReactNode }) {
  return (
    <Text as="h3" variant="caption" className={styles.sub}>
      {children}
    </Text>
  );
}

const COLOR_RAW: [string, Source][] = [
  ['--color-lime', 'ds'],
  ['--color-gray-light', 'ds'],
  ['--color-black', 'ds'],
  ['--color-gray', 'ds'],
  ['--color-white', 'screen'],
];

const COLOR_SEMANTIC: [string, Source][] = [
  ['--color-accent', 'ds'],
  ['--color-on-accent', 'ds'],
  ['--color-text-primary', 'ds'],
  ['--color-text-secondary', 'ds'],
  ['--color-text-inverse', 'screen'],
  ['--color-surface', 'screen'],
  ['--color-surface-muted', 'ds'],
  ['--color-border', 'temp'],
  ['--color-focus-ring', 'temp'],
];

const COLOR_TEMP: [string, Source][] = [
  ['--color-danger', 'temp'],
  ['--color-border-control', 'temp'],
  ['--color-surface-field', 'screen'],
  ['--color-page-bg', 'temp'],
];

const SIZE_TOKENS: [string, Source][] = [
  ['--space-page', 'screen'],
  ['--space-1', 'temp'],
  ['--space-2', 'temp'],
  ['--space-3', 'temp'],
  ['--space-4', 'temp'],
  ['--space-5', 'temp'],
  ['--space-6', 'temp'],
  ['--radius-card', 'screen'],
  ['--radius-field', 'screen'],
  ['--radius-pill', 'screen'],
  ['--shadow-floating', 'screen'],
  ['--button-height-large', 'screen'],
  ['--button-height-small', 'screen'],
  ['--chip-height', 'screen'],
  ['--tap-target-min', 'temp'],
  ['--bottom-nav-height', 'screen'],
  ['--layout-max-width', 'temp'],
];

function Swatches({ tokens }: { tokens: [string, Source][] }) {
  return (
    <ul className={styles.swatches}>
      {tokens.map(([token, source]) => (
        <li key={token} className={styles.swatch}>
          <span className={styles.chipColor} style={{ background: `var(${token})` }} aria-hidden />
          <span className={styles.swatchText}>
            <code>{token}</code>
            <TokenValue token={token} />
            <SourceTag source={source} />
          </span>
        </li>
      ))}
    </ul>
  );
}

const FILTER_OPTIONS = [
  { value: 'all', label: '전체' },
  { value: 'missing', label: '없는 가게' },
  { value: 'requested', label: '주민 요청' },
  { value: 'existing', label: '있는 가게' },
] as const;

type Filter = (typeof FILTER_OPTIONS)[number]['value'];

function ButtonsDemo() {
  const [busy, setBusy] = useState(false);
  const [clicks, setClicks] = useState(0);

  useEffect(() => {
    if (!busy) return;
    const timer = setTimeout(() => setBusy(false), 1500);
    return () => clearTimeout(timer);
  }, [busy]);

  return (
    <>
      <Sub>primary (검정 배경 + 흰 텍스트) · large</Sub>
      <div className={styles.stack}>
        <Button fullWidth>기본</Button>
        <Button fullWidth disabled>
          비활성
        </Button>
        <Button fullWidth loading>
          처리 중인 버튼
        </Button>
      </div>
      <Sub>highlight (라임 배경 + 검정 텍스트) · large</Sub>
      <div className={styles.stack}>
        <Button variant="highlight" fullWidth>
          기본
        </Button>
        <Button variant="highlight" fullWidth disabled>
          비활성
        </Button>
        <Button variant="highlight" fullWidth loading>
          처리 중인 버튼
        </Button>
      </div>
      <Sub>small (시각적 36px, 터치 영역 44px)</Sub>
      <div className={styles.row}>
        <Button size="small">+가게 요청하기</Button>
        <Button size="small" variant="highlight">
          기본
        </Button>
        <Button size="small" disabled>
          비활성
        </Button>
        <Button size="small" loading>
          저장
        </Button>
        <LinkButton to="/" size="small" variant="highlight">
          링크 버튼
        </LinkButton>
      </div>
      <Sub>loading 중복 실행 방지 — 누르면 1.5초간 loading, 그동안 클릭은 무시됩니다</Sub>
      <div className={styles.stack}>
        <Button
          fullWidth
          loading={busy}
          onClick={() => {
            setClicks((n) => n + 1);
            setBusy(true);
          }}
        >
          요청 보내기
        </Button>
        <Text variant="caption">처리된 클릭: {clicks}번</Text>
      </div>
      <Sub>여러 줄 텍스트</Sub>
      <Button fullWidth variant="highlight">
        우리 동네에 생겼으면 하는 가게를 요청하고 이웃에게도 링크로 알려서 함께 모아 보기
      </Button>
      <Sub>IconButton (접근 가능한 이름 필수, 44px)</Sub>
      <div className={styles.row}>
        <IconButton label="뒤로 가기" icon={<ArrowLeftIcon />} />
        <IconButton label="비활성 아이콘 버튼" icon={<ArrowLeftIcon />} disabled />
      </div>
    </>
  );
}

function ChipsDemo() {
  const [filter, setFilter] = useState<Filter>('all');
  const [onlyOpen, setOnlyOpen] = useState(false);

  return (
    <>
      <Sub>radio — 하나만 선택 (방향키로 이동)</Sub>
      <ChipGroup
        label="지도 필터 예시"
        options={FILTER_OPTIONS}
        value={filter}
        onChange={setFilter}
      />
      <Sub>toggle — 켜고 끄기(aria-pressed)</Sub>
      <div className={styles.row}>
        <ChoiceChip mode="toggle" selected={onlyOpen} onToggle={setOnlyOpen}>
          영업 중만
        </ChoiceChip>
        <ChoiceChip mode="toggle" selected onToggle={() => {}} disabled>
          선택됨 · 비활성
        </ChoiceChip>
        <ChoiceChip mode="toggle" selected={false} onToggle={() => {}} disabled>
          비선택 · 비활성
        </ChoiceChip>
      </div>
      <Sub>고정 상태 (선택 / 비선택)</Sub>
      <div className={styles.row}>
        <ChoiceChip mode="radio" name="static-demo" value="a" selected onSelect={() => {}}>
          선택
        </ChoiceChip>
        <ChoiceChip mode="radio" name="static-demo" value="b" selected={false} onSelect={() => {}}>
          비선택
        </ChoiceChip>
      </div>
    </>
  );
}

function TextAreaDemo() {
  const [value, setValue] = useState('');

  return (
    <div className={styles.stack}>
      <TextArea
        label="원하는 가게와 조건"
        description="어떤 가게가 생기면 좋을지 자유롭게 적어 주세요."
        placeholder="예: 밤 10시까지 하는 과일가게요."
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
      <TextArea
        label="오류 상태"
        description="비워 둘 수 없어요."
        defaultValue=""
        error="내용을 입력해 주세요."
      />
    </div>
  );
}

const LONG_TEXT =
  '동네 지도에서 없는 가게를 보고, 생겼으면 하는 가게를 요청해요. 요청이 모이면 사장님과 창업자가 봐요. 줄바꿈은 단어 단위로 이루어지고, 아주 긴 문자열만 강제로 나뉩니다.';
const LONG_UNBROKEN =
  'https://example.com/아주-긴-주소는-화면-밖으로-넘치지-않고-줄바꿈-됩니다/0123456789';

/** 디자인 시스템 확인용 개발 페이지. MobileLayout 의 header·bottomNav 슬롯을 모두 사용해 보여준다. */
export function DesignSystemPage() {
  return (
    <MobileLayout
      header={
        <div className={styles.header}>
          <Text variant="title">디자인 시스템</Text>
          <span className={styles.devBadge}>개발 전용</span>
        </div>
      }
      bottomNav={
        <BottomNav
          label="디자인 시스템 예시 메뉴"
          items={[
            { to: '/dev/design-system', label: '디자인 시스템', end: true },
            { to: '/', label: '첫 화면', end: true },
          ]}
        />
      }
    >
      <div className={styles.page}>
        <Text as="h1" variant="title">
          디자인 시스템 확인
        </Text>
        <Text variant="caption">
          개발 환경에서만 보이는 페이지예요. 각 값 옆의 표시로 출처를 구분해요.
        </Text>
        <ul className={styles.legend}>
          {(Object.keys(SOURCE_LABEL) as Source[]).map((source) => (
            <li key={source}>
              <SourceTag source={source} />
            </li>
          ))}
        </ul>

        <Section id="ds-color" title="색상">
          <Sub>원시 토큰</Sub>
          <Swatches tokens={COLOR_RAW} />
          <Sub>의미 토큰</Sub>
          <Swatches tokens={COLOR_SEMANTIC} />
          <Sub>디자인 시스템에 아직 없는 임시 토큰</Sub>
          <Swatches tokens={COLOR_TEMP} />
        </Section>

        <Section id="ds-type" title="타이포그래피">
          <Text variant="caption">
            행간은 문서의 &quot;22% / 19% / 18%&quot; 표기를 px 로 임시 해석한 값이에요(확정 아님).
          </Text>
          <div className={styles.typeRow}>
            <Text variant="title">Title 가게 요청하기 1234</Text>
            <Text variant="caption">
              <SourceTag source="ds" /> Bold <TokenValue token="--font-size-title" /> / 행간{' '}
              <TokenValue token="--line-height-title" />
            </Text>
          </div>
          <div className={styles.typeRow}>
            <Text variant="contents">Contents 동네에 없는 가게를 요청해요 1234</Text>
            <Text variant="caption">
              <SourceTag source="ds" /> Medium <TokenValue token="--font-size-contents" /> / 행간{' '}
              <TokenValue token="--line-height-contents" />
            </Text>
          </div>
          <div className={styles.typeRow}>
            <Text variant="caption">Caption 요청 많은 순 · 걸어서 15분 안 1234</Text>
            <Text variant="caption">
              <SourceTag source="ds" /> Medium <TokenValue token="--font-size-caption" /> / 행간{' '}
              <TokenValue token="--line-height-caption" /> / 색 Sub2
            </Text>
          </div>
          <div className={styles.typeRow}>
            <Text variant="display">Display 우리 동네에 없는 가게, 원하면 생겨요</Text>
            <Text variant="caption">
              <SourceTag source="screen" /> 온보딩 큰 제목{' '}
              <TokenValue token="--font-size-display" /> (원본 SemiBold, 여기서는 Bold)
            </Text>
          </div>
          <Sub>시각 스타일과 HTML 의미 분리: 같은 Title 스타일을 다른 태그로</Sub>
          <Text as="h3" variant="title">
            h3 태그 + Title 스타일
          </Text>
          <Text as="span" variant="title">
            span 태그 + Title 스타일
          </Text>
          <Sub>긴 한국어 텍스트</Sub>
          <Text>{LONG_TEXT}</Text>
          <Text variant="caption">{LONG_TEXT}</Text>
          <Text variant="caption">{LONG_UNBROKEN}</Text>
        </Section>

        <Section id="ds-buttons" title="버튼">
          <ButtonsDemo />
        </Section>

        <Section id="ds-chips" title="칩">
          <ChipsDemo />
        </Section>

        <Section id="ds-textarea" title="TextArea">
          <TextAreaDemo />
        </Section>

        <Section id="ds-cards" title="카드">
          <Card>
            <Text as="p" variant="title">
              기본 카드
            </Text>
            <Text variant="caption">흰 배경에 테두리가 있는 카드예요.</Text>
          </Card>
          <Card tone="accent">
            <Text as="p" variant="title">
              강조 카드
            </Text>
            <Text>라임 배경 위 텍스트는 검정이에요.</Text>
          </Card>
          <CardLink to="/" tone="accent">
            <Text as="span" variant="title">
              카드 전체가 링크인 카드
            </Text>
            <br />
            <Text as="span">안에 버튼이나 다른 링크를 넣지 않아요.</Text>
          </CardLink>
          <Card tone="accent">
            <Text as="p" variant="title">
              {LONG_TEXT}
            </Text>
          </Card>
        </Section>

        <Section id="ds-sizes" title="간격·모서리·크기 토큰">
          <Text variant="caption">
            디자인 시스템 문서에는 이 값들이 없어요. 화면에서 읽었거나 임시로 정한 값이에요.
          </Text>
          <ul className={styles.sizeList}>
            {SIZE_TOKENS.map(([token, source]) => (
              <li key={token} className={styles.sizeItem}>
                <code>{token}</code>
                <TokenValue token={token} />
                <SourceTag source={source} />
              </li>
            ))}
          </ul>
        </Section>

        <Section id="ds-layout" title="모바일 공통 레이아웃">
          <Text>
            이 페이지가 MobileLayout 을 그대로 사용해요. 위쪽 헤더 슬롯(&quot;디자인 시스템 · 개발
            전용&quot;)과 아래쪽 하단 내비게이션 슬롯이 모두 채워져 있어요.
          </Text>
          <ul className={styles.notes}>
            <li>
              <Text variant="caption">
                최대 너비 <TokenValue token="--layout-max-width" /> 안에서 중앙 정렬하고, 높이는
                고정하지 않아요(100vh → 100dvh).
              </Text>
            </li>
            <li>
              <Text variant="caption">
                iOS safe-area(상·하·좌·우)를 반영해요. 하단 내비게이션 높이만큼 본문 끝에 여백을
                더해서 마지막 줄이 가려지지 않아요.
              </Text>
            </li>
            <li>
              <Text variant="caption">
                Figma 402 × 874 는 참고 크기이고 웹 화면에 고정하지 않아요.
              </Text>
            </li>
          </ul>
        </Section>
      </div>
    </MobileLayout>
  );
}
