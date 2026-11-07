# neighborhood-demand-web

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
    selection/  역할·동네 선택 (Context, 폼, 역할 정의, assets/ 캐릭터 이미지)
    demand/     수요 카드·수치·리포트 목록/로더
    resident-map/  주민 탐색 화면: 지도 필터·마커 규칙(순수 함수), 요청 카드, 데이터 훅. 마커 위치는 지도 영역 대비 상대좌표(0~1)이며 네이버 지도 연동 때 위경도로 교체 예정
    store-request/  가게 요청하기 화면: 선택지 상수, 문장 정리 훅(오래된 응답 무시), 칩 그룹, AI 정리 카드, 제출 가능 여부 규칙
    my-requests/  내 요청 화면: 진행 상황 요약 카드, 요청 카드, 이웃에게 알리기(공유), 진행률·문구 규칙
  shared/
    ui/         공통 UI (Text, Button, IconButton, ChoiceChip, ChipGroup, TextArea, Card, Page, Notice, BottomNav, MapPlaceholder, SampleDataBadge)
    layouts/    MobileLayout(헤더·하단 내비 슬롯), RootLayout·ResidentTabsLayout(라우트용)
    assets/     공통 이미지(로고)
    lib/        경로 상수, useAsyncData
    styles/     tokens.css(디자인 토큰), fonts.css(@font-face), global.css(reset·전역), fonts/(Pretendard WOFF2·라이선스)
  services/     데이터 접근 인터페이스, 목 구현, 입력 문장 정리(키워드 규칙 목)·요청 제출·내 요청 조회(메모리 목) 인터페이스, AI 설명 생성 인터페이스(타입만)
  mocks/        목 데이터, 메모리 DB(요청 제출 시 인원이 늘어나는 상태. 새로고침하면 시드로 초기화)
  types/        공통 도메인 타입
  test/         테스트 설정과 renderApp 헬퍼
```

`@` 는 `src` 의 별칭이며 `vite.config.ts`(개발·빌드·Vitest 공유)와 `tsconfig.app.json`(타입 검사)에 설정되어 있습니다.

## 모바일 웹 대응

- viewport: `width=device-width, initial-scale=1, viewport-fit=cover` (확대를 막지 않음)
- 콘텐츠 영역은 `--layout-max-width`(430px) 안에서 중앙 정렬하며 높이를 고정하지 않습니다(`100vh` fallback + `100dvh`).
- iOS safe-area(`env(safe-area-inset-*)`) 대응, 하단 내비게이션 높이만큼 본문 여백 확보.
- 입력 필드 글자 크기 16px 이상(iOS 포커스 자동 확대 방지), 주요 터치 영역 최소 44px.
- 한국어 `word-break: keep-all` + 긴 문자열 `overflow-wrap: anywhere`.
- 지도 영역은 너비에 비례(`aspect-ratio`)하고 마커는 영역 대비 비율로 배치해 너비가 달라져도 위치 관계가 유지됩니다.
- 하단 내비와 그 위에 떠 있는 버튼은 본문 하단 여백을 늘려 마지막 항목을 가리지 않게 합니다.
- 선택 상태는 색상 외에 체크 표시·라디오 선택(`checked`)·`aria-pressed`·`aria-current`·밑줄·굵은 아이콘으로도 전달합니다.

## 개발용 확인 페이지

```bash
pnpm dev   # → http://localhost:5173/dev/design-system
```

색상 스와치와 토큰 이름·값, 타이포그래피, 버튼(기본·disabled·loading), 칩, TextArea(기본·오류), 카드, 긴 한국어 텍스트, 모바일 레이아웃 예시를 보여줍니다. 각 값에 `디자인 시스템 명시` / `화면에서 확인` / `임시` 표시가 붙어 있습니다.

- 개발 환경(`import.meta.env.DEV`)에서만 라우트가 등록되고, 페이지는 `lazy` 로 불러옵니다. 프로덕션 빌드 번들에는 포함되지 않으며 `/dev/design-system` 은 Not Found 로 처리됩니다(빌드 결과에서 문자열 검색으로 확인).
