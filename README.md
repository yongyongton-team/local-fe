# neighborhood-demand-web

> **`neighborhood-demand-web` 은 임시 이름입니다.** 서비스명이 확정되면 `package.json`의 `name`, `index.html`의 `<title>`, 이 제목을 함께 바꿉니다.

동네에 없는 가게에 대한 주민 수요를 모으고, 사장님과 예비 창업자가 그 수요를 확인하는 모바일 웹 서비스의 프런트엔드입니다. 현재는 **프로젝트 초기 세팅 단계**로, 화면은 페이지 골격 수준이고 데이터는 모두 목(mock)입니다.

## 기술 스택

React 19 · TypeScript(strict) · Vite · React Router · CSS Modules · Vitest + React Testing Library · ESLint(flat config) + Prettier · pnpm · Pretendard(자체 호스팅 WOFF2)

## 설치와 실행

필요한 것: Node.js 24 LTS(`.nvmrc` 참고)와 pnpm 12(`package.json`의 `packageManager`).

```bash
nvm use            # 또는 .nvmrc 의 Node 버전을 직접 설치
corepack enable    # packageManager 에 고정된 pnpm 을 사용
pnpm install
pnpm dev           # 개발 서버
```

| 명령                | 설명                               |
| ------------------- | ---------------------------------- |
| `pnpm dev`          | 개발 서버 실행                     |
| `pnpm build`        | 타입 검사 후 프로덕션 빌드         |
| `pnpm preview`      | 빌드 결과 미리보기                 |
| `pnpm lint`         | ESLint                             |
| `pnpm typecheck`    | TypeScript 타입 검사               |
| `pnpm test`         | Vitest watch 모드 (작업 중 대화형) |
| `pnpm test:run`     | 테스트 1회 실행 (CI·검증용)        |
| `pnpm format`       | Prettier 로 파일 수정              |
| `pnpm format:check` | Prettier 포맷 검사                 |

지도 SDK, 백엔드, AI 키 없이 실행됩니다.

## 라우트

| 경로                            | 화면                    |
| ------------------------------- | ----------------------- |
| `/`                             | 역할 및 동네 선택       |
| `/resident`                     | 주민용 동네 탐색        |
| `/resident/requests/new`        | 가게 요청 작성          |
| `/resident/requests`            | 내 요청                 |
| `/merchant`                     | 사장님용 수요 동네 탐색 |
| `/merchant/areas/:areaId`       | 사장님용 동네 수요 상세 |
| `/founder`                      | 예비 창업자용 입지 탐색 |
| `/founder/areas/:areaId/report` | 동네 리포트             |
| 그 외                           | Not Found               |

- 라우트 정의(`src/app/routes.tsx`)는 라우터 생성 코드(`router.tsx`)와 분리되어 있어 테스트에서 메모리 라우터로 재사용합니다.
- `:areaId` 는 `Neighborhood.id` 와 같습니다. 존재하지 않으면 해당 페이지 안에서 "찾을 수 없음"을 안내합니다.
- Figma 에서 같은 화면의 여러 상태(역할 선택 3종, 지도 필터 4종, 탐색 범위 3종, 동네별 리포트)는 별도 페이지가 아니라 공통 페이지의 상태(`useState`)나 `:areaId` 로 모델링했습니다.

### 선택 상태와 직접 진입

- 첫 화면에서 고른 역할과 동네는 작은 Context(`features/selection/SelectionContext.tsx`)에만 보관합니다. **새로고침하면 초기화됩니다.**
- 역할 선택은 인증·접근 권한이 아닙니다. 선택 없이 URL로 직접 들어와도 페이지는 렌더링되며 차단·리다이렉트하지 않습니다. 동네 선택이 필요한 주민 화면(`/resident`, `/resident/requests/new`)은 페이지 안에 선택 안내와 첫 화면 링크를 보여줍니다.

## 폴더 구조

```
src/
  app/          앱 진입(main.tsx), 라우트 정의(routes.tsx), 라우터 생성(router.tsx), 전역 Provider
  pages/        라우트 단위 페이지 (dev/ 는 개발 전용 디자인 시스템 확인 페이지)
  features/
    selection/  역할·동네 선택 (Context, 폼, 역할 정의)
    demand/     수요 카드·수치·리포트 목록/로더
  shared/
    ui/         공통 UI (Text, Button, IconButton, ChoiceChip, ChipGroup, TextArea, Card, Page, Notice, BottomNav, MapPlaceholder, SampleDataBadge)
    layouts/    MobileLayout(헤더·하단 내비 슬롯), RootLayout·ResidentTabsLayout(라우트용)
    lib/        경로 상수, useAsyncData
    styles/     tokens.css(디자인 토큰), fonts.css(@font-face), global.css(reset·전역), fonts/(Pretendard WOFF2·라이선스)
  services/     데이터 접근 인터페이스, 목 구현, AI 설명 생성 인터페이스(타입만)
  mocks/        목 데이터
  types/        공통 도메인 타입
  test/         테스트 설정과 renderApp 헬퍼
```

`@` 는 `src` 의 별칭이며 `vite.config.ts`(개발·빌드·Vitest 공유)와 `tsconfig.app.json`(타입 검사)에 설정되어 있습니다.

## 환경 변수

현재 환경 변수를 사용하지 않습니다. `.env*` 는 `.gitignore` 로 제외되고 값 없는 `.env.example` 만 커밋됩니다.

> **`VITE_` 접두사 환경 변수는 브라우저 번들에 포함되어 누구에게나 공개됩니다.** AI 비밀 키, 토큰 등 비밀 값을 `VITE_` 변수에 넣지 마세요. 비밀 키가 필요한 호출(예: AI)은 서버에서 처리해야 합니다.

## 데이터와 외부 연동 경계

- **목 데이터**: `src/mocks/demand.ts` (구성동·보정동·마북동, 과일·채소). 실제 검증된 통계가 아니며, 이를 보여주는 화면에는 "예시 데이터" 배지를 표시합니다.
- **서비스**: `src/services/demandService.ts` 의 `DemandService` 인터페이스를 페이지가 사용하고, 현재 구현은 비동기 목(`mockDemandService.ts`)입니다. 실제 API 도입 시 `services/index.ts` 의 구현만 교체합니다.
- **지도**: `MapPlaceholder` 자리표시자만 있습니다. 지도 SDK 선택·연동은 후속 작업이며, 현재 위치 권한은 요청하지 않습니다.
- **AI**: `services/reportDescription.ts` 에 "설명 문장 생성" 인터페이스 타입만 있고 구현·SDK·호출은 없습니다. 수치·거리·순위는 구조화된 데이터가 기준이고 AI 는 설명 문장 작성에만 사용할 예정입니다. 리포트 화면의 설명 영역은 "준비 중" 자리표시자입니다.

## 모바일 웹 대응

- viewport: `width=device-width, initial-scale=1, viewport-fit=cover` (확대를 막지 않음)
- 콘텐츠 영역은 `--layout-max-width`(430px) 안에서 중앙 정렬하며 높이를 고정하지 않습니다(`100vh` fallback + `100dvh`).
- iOS safe-area(`env(safe-area-inset-*)`) 대응, 하단 내비게이션 높이만큼 본문 여백 확보.
- 입력 필드 글자 크기 16px 이상(iOS 포커스 자동 확대 방지), 주요 터치 영역 최소 44px.
- 한국어 `word-break: keep-all` + 긴 문자열 `overflow-wrap: anywhere`.
- 선택 상태는 색상 외에 체크 표시·`aria-pressed`·`aria-current`·밑줄로도 전달합니다.

## 디자인 시스템

Figma 디자인 시스템 문서(node 7:30)와 서비스 화면(node 1:3)을 읽어 반영했습니다. 적용 우선순위는 **① 디자인 시스템 명시값 → ② 서비스 화면 → ③ 최소한의 임시 기준**입니다.

### 개발용 확인 페이지

```bash
pnpm dev   # → http://localhost:5173/dev/design-system
```

색상 스와치와 토큰 이름·값, 타이포그래피, 버튼(기본·disabled·loading), 칩, TextArea(기본·오류), 카드, 긴 한국어 텍스트, 모바일 레이아웃 예시를 보여줍니다. 각 값에 `디자인 시스템 명시` / `화면에서 확인` / `임시` 표시가 붙어 있습니다.

- 개발 환경(`import.meta.env.DEV`)에서만 라우트가 등록되고, 페이지는 `lazy` 로 불러옵니다. 프로덕션 빌드 번들에는 포함되지 않으며 `/dev/design-system` 은 Not Found 로 처리됩니다(빌드 결과에서 문자열 검색으로 확인).

### 토큰 (`src/shared/styles/tokens.css`)

각 토큰에 출처를 주석으로 표시합니다: `[DS]` 디자인 시스템 명시, `[화면]` 서비스 화면에서 읽은 값, `[임시]` 확인하지 못해 임시로 정한 값.

| 구분      | 토큰                                                                                    | 값                                                           | 출처                            |
| --------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------- |
| 원시 색   | `--color-lime`                                                                          | `#C8FF80` (Main)                                             | DS                              |
|           | `--color-gray-light`                                                                    | `#E4E4E4` (Sub)                                              | DS                              |
|           | `--color-black`                                                                         | `#000000` (Font)                                             | DS                              |
|           | `--color-gray`                                                                          | `#757575` (Sub2)                                             | DS                              |
|           | `--color-white`                                                                         | `#FFFFFF`                                                    | 화면                            |
| 의미 색   | `--color-accent` · `--color-on-accent`                                                  | 라임 · 검정                                                  | DS                              |
|           | `--color-text-primary` · `--color-text-secondary`                                       | 검정 · Sub2                                                  | DS                              |
|           | `--color-surface` · `--color-surface-muted`                                             | 흰색 · Sub                                                   | 화면 · DS                       |
|           | `--color-border` · `--color-focus-ring`                                                 | Sub · 검정                                                   | 임시                            |
| 임시 색   | `--color-danger`                                                                        | `#F04856`                                                    | 화면에서 관찰, 오류 용도는 임시 |
|           | `--color-border-control` · `--color-page-bg`                                            | Sub2 · `#F5F5F5`                                             | 임시                            |
|           | `--color-surface-field`                                                                 | `#F2F2F2` (원본 `rgba(195,195,195,0.21)` 근사)               | 화면                            |
| 글꼴      | `--font-family-base`                                                                    | Pretendard + 한글 시스템 폰트 폴백                           | DS + 임시                       |
| 타이포    | `--font-title` / `--font-contents` / `--font-caption`                                   | Bold 18 / Medium 16 / Medium 14 (px)                         | DS                              |
|           | `--line-height-title` / `-contents` / `-caption`                                        | 22 / 19 / 18 (px)                                            | **임시 해석**                   |
| 개별 화면 | `--font-display`, `--font-size-chip`, `--font-size-button-*`                            | 28 / 12 / 18·14 (px)                                         | 화면                            |
| 크기      | `--button-height-large` / `-small`, `--chip-height`, `--bottom-nav-height`              | 60 / 36 / 26 / 66 (px)                                       | 화면                            |
|           | `--radius-card`, `--radius-field`, `--radius-pill`, `--shadow-floating`, `--space-page` | 20px, 20px, 완전 알약형, `0 2px 10px rgb(0 0 0 / 10%)`, 20px | 화면                            |
|           | `--space-1`~`--space-6`, `--layout-max-width`, `--bottom-nav-gap`                       | 4~32px, 430px, 12px                                          | 임시                            |

- 컴포넌트에서는 HEX 를 직접 쓰지 않고 의미 토큰만 참조합니다. 글자 스타일은 `font: var(--font-title)` 처럼 합성 토큰으로 지정합니다.
- 다크 모드는 포함하지 않았습니다.
- 라임은 흰 배경 위 작은 글자 색으로 쓰지 않고, 라임 배경 위 텍스트·아이콘은 검정입니다.

### 폰트 (Pretendard)

- 출처: npm `pretendard@1.3.9` 의 `dist/web/static/woff2-subset` (패키지 sha512 무결성을 레지스트리 값과 대조해 확인). 저장소 [orioncactus/pretendard](https://github.com/orioncactus/pretendard).
- 라이선스: SIL Open Font License 1.1 — 전문은 `src/shared/styles/fonts/LICENSE.txt`.
- 포함 파일: Medium(500), Bold(700) 서브셋 WOFF2 각 약 270KB (디자인 시스템이 정의한 두 굵기). `font-display: swap`.
- 서브셋에는 한글 2,780자가 있어, 없는 글자(희귀 음절 등)는 시스템 한글 폰트로 대체됩니다.
- 새 의존성으로 설치하지 않고 파일만 복사했습니다. 출력 파일은 Vite 가 해시 이름으로 번들합니다.

### 공통 UI 사용법

```tsx
import { Text } from '@/shared/ui/Text';
import { Button, LinkButton } from '@/shared/ui/Button';
import { ChipGroup } from '@/shared/ui/ChipGroup';
import { ChoiceChip } from '@/shared/ui/ChoiceChip';
import { TextArea } from '@/shared/ui/TextArea';
import { Card, CardLink } from '@/shared/ui/Card';
import { IconButton } from '@/shared/ui/IconButton';

// 시각 스타일(variant)과 HTML 의미(as)는 따로 정한다.
<Text as="h2" variant="title">제목</Text>        // title | contents | caption | display

// primary: 검정 배경 · highlight: 라임 배경. size: large(60px, 기본) | small(36px, 터치 44px)
<Button fullWidth>시작하기</Button>
<Button variant="highlight" size="small" loading={busy}>저장</Button>   // loading 중 중복 실행 방지
<LinkButton to="/resident">화면 이동</LinkButton>                         // 이동은 링크로

<IconButton label="뒤로 가기" icon={<ArrowLeftIcon />} />                 // label 필수

// 하나만 고르는 칩 묶음(radiogroup) / 개별 칩(mode: radio | toggle)
<ChipGroup label="지도 필터" options={options} value={v} onChange={setV} />
<ChoiceChip mode="toggle" selected={on} onToggle={setOn}>영업 중만</ChoiceChip>

// label · 설명 · 오류가 aria-describedby 로 연결됨. 네이티브 textarea 속성 그대로 사용
<TextArea label="내용" description="설명" error={error} value={v} onChange={...} />

// 카드 전체가 눌리면 CardLink(안에 버튼·링크 중첩 금지), 아니면 Card
<CardLink to="/merchant/areas/guseong" tone="accent">…</CardLink>
```

`MobileLayout` 은 `header`·`bottomNav` 슬롯을 받는 레이아웃입니다(`<MobileLayout header={…} bottomNav={…}>`). 라우트에서는 `RootLayout`(내비 없음), `ResidentTabsLayout`(주민 하단 내비)을 씁니다. 하단 내비가 있으면 본문 하단 여백이 자동으로 늘어납니다.

### 디자인 확인이 필요한 항목

1. **행간 `22% / 19% / 18%`**: 문서 표기를 CSS `line-height: 22%` 처럼 쓰면 글자가 겹쳐서 `22px / 19px / 18px` 로 **임시 해석**했습니다. 확정된 값이 아닙니다. 16px 글자에 행간 19px(약 1.19배)는 여러 줄 문단에서 빽빽할 수 있습니다. 의도(px, 배수, 글자 크기 대비 %)를 확인한 뒤 `tokens.css` 의 `--line-height-*` 만 바꾸면 됩니다.
2. **명시되지 않은 규격**: 버튼 높이, 모서리 반경, 간격 스케일, 그림자. 화면에서 읽은 값(버튼 60/36px, 카드 20px, 내비 그림자 등)은 `[화면]`, 나머지는 `[임시]` 로 표시했습니다.
3. **기본 타이포그래피와 화면의 개별 예외**: 화면에는 디자인 시스템 밖의 스타일이 쓰입니다.
   - 온보딩 큰 제목: Pretendard SemiBold 28px, 자간 -2%. SemiBold(600) 파일은 포함하지 않아 Bold(700)로 표시합니다(`display` 스타일).
   - 칩 라벨 12px, 카드 제목 14px SemiBold, 카드 보조 문구 12px `#4D4D4D`, 큰 버튼 라벨 18px, 소개 문구 `#868181`, 일부 라벨 자간 -2%.
   - 이 값들은 디자인 시스템의 Title/Contents/Caption 에 들어맞지 않아 통일하지 않았습니다. 기본 스타일에 편입할지 확인이 필요합니다.
4. **라임 변형**: 화면에는 `#BCFF65`(그라데이션 끝), `rgba(188,255,101,0.8)` 도 보이지만 디자인 시스템 Main 은 `#C8FF80` 하나뿐이라 후자만 토큰으로 두고 강조 카드는 단색으로 처리했습니다. 역할 선택 카드의 흰색→라임 그라데이션은 적용하지 않았습니다.
5. **오류 색 대비**: 임시 오류 색(`#F04856`)은 흰 배경에서 대비가 3.64:1 로 14px 굵은 글자 기준(4.5:1)에 못 미칩니다. 확정 전 점검이 필요합니다.
6. **칩 크기·대비**: 화면의 칩은 높이 26px / 텍스트 12px 입니다. 시각적 크기는 유지하고 터치 영역만 44px 로 넓혔습니다. 또 비선택 칩의 조합(Sub2 `#757575` 텍스트 + Sub `#E4E4E4` 배경)은 대비가 3.62:1 로 작은 글자 기준(4.5:1)에 못 미칩니다. 디자인 시스템 색 그대로 구현했으므로 텍스트 색이나 크기를 바꿀지 확인이 필요합니다.
7. **선택 표시 추가**: 색상 외 수단으로 선택된 칩에 체크 아이콘과 1px 검정 테두리를 추가했습니다(화면에는 없음).

## 임시 결정 사항

1. **임시 서비스명**: `neighborhood-demand-web`. 로고·브랜딩은 넣지 않았습니다(Figma 의 로고 이미지는 사용하지 않음).
2. **임시 디자인 토큰**: 위 "토큰" 표의 `[임시]` 값들.
3. **임시 하단 내비게이션**: 주민 화면(`/resident`, `/resident/requests`)에만 `탐색 · 내 요청` 2탭. Figma 에는 3탭(아이콘만)이 있으나 세 번째 탭의 의미를 확인하지 못했습니다. (`shared/layouts/ResidentTabsLayout.tsx`)
4. **선택 상태 초기화**: 역할·동네 선택은 메모리에만 있어 새로고침 시 초기화됩니다.
5. **기본 업종**: 업종 선택 UI 확정 전까지 `DEFAULT_CATEGORY_ID`(과일·채소)를 화면이 공통으로 사용합니다.
6. **행간 px 해석**: 위 "디자인 확인이 필요한 항목" 1번.


