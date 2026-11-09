# neighborhood-demand-web

## 기술 스택

React 19 · TypeScript(strict) · Vite · React Router · CSS Modules · Vitest + React Testing Library · ESLint(flat config) + Prettier · pnpm · Pretendard(자체 호스팅 WOFF2) · 네이버 지도(Web Dynamic Map, JavaScript API v3. 스크립트는 지도가 필요한 화면에서 동적으로 불러오고 타입은 `@types/navermaps`)

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

백엔드, AI 키 없이 실행됩니다(기본은 목 데이터). 네이버 지도 키도 없어도 실행되며, 그때는 기존 자리표시자 지도를 보여줍니다.

실제 지도를 보려면 `.env.example` 을 참고해 `.env.local` 에 `VITE_NAVER_MAP_CLIENT_ID`(네이버 클라우드 콘솔의 Web Dynamic Map Client ID)를 넣고 개발 서버를 다시 시작합니다. `.env.local` 은 커밋되지 않습니다. `VITE_` 접두사 변수는 브라우저 번들에 그대로 공개되므로 Client Secret 이나 비밀 키는 넣지 않습니다(프런트에서 필요하지 않습니다). 콘솔의 Web 서비스 URL 에 `http://localhost:5173` 과 배포 주소를 등록해야 인증됩니다.

백엔드 API 는 환경 변수로 고릅니다. 값이 없으면 `mock` 이라 네트워크 요청과 로그인이 전혀 일어나지 않습니다.

| 변수                     | 설명                                                                                                                                                                           |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `VITE_DATA_SOURCE`       | `mock`(기본) 또는 `api`. 잘못된 값은 `mock` 으로 처리하고 개발 환경에서만 경고합니다.                                                                                          |
| `VITE_API_BASE_URL`      | API 호스트만(예: `https://example.com`). `/api/v1` 은 코드가 붙입니다. `VITE_DATA_SOURCE=api` 일 때만 씁니다.                                                                  |
| `VITE_ENABLE_DEMO_LOGIN` | 시연용. `true` 이고 API 모드일 때만 켜집니다(기본 꺼짐). 켜면 `/?demo=owner` 로 공유 사장님 데모 계정에 들어가고(역할·동네를 바꾸는 쓰기는 막힙니다) `/?demo=off` 로 나옵니다. |

`VITE_` 변수는 브라우저에 공개되므로 토큰·비밀 값은 넣지 않습니다. **API 모드는 일부 서비스만 실제이며 단계적으로 늘어납니다.** 지금 서버를 쓰는 것은 인증(게스트 로그인), 내 정보·역할과 동네 저장(`/me`), 동네·업종 목록(`/dongs`, `/categories`), 주민 조회(`/dongs/{id}/gaps`, `/dongs/{id}/map`)뿐이며 **주민 조회 연결됨**이고 새로고침 후 역할·동네 복원됨(`GET /me`)입니다. **요청 작성·내 요청 연결됨**, **내 요청의 사장님 응답 연결됨**(제안 읽기만, 제안 작성·선주문은 아직), **창업자(입지 순위·동네 리포트) 연결됨**, **사장님(가게 정보·동네 수요) 연결됨**입니다(요청 정리는 AI 호출이라 몇 초 걸리고, 서버가 시간대와 빈도를 필수로 받아서 API 모드에서는 둘을 골라야 보낼 수 있습니다). 사장님·창업자·제안·주문 데이터는 모드와 무관하게 목(slug id 기준)이라 API 모드에서 숫자 id 로 들어가면 그 화면들이 비거나 "찾을 수 없음"이 나올 수 있습니다. 서버는 로그인할 때마다 새 사용자를 만들기 때문에(게스트 토큰을 잃으면 내 요청도 사라집니다) 토큰은 30일 유효한 점을 고려해 메모리와 `localStorage` 에 보관합니다(`localStorage` 접근이 막히면 메모리만 씁니다). `localStorage` 는 같은 출처의 스크립트(XSS)가 읽을 수 있어서, 이 앱은 사용자 입력을 HTML 로 렌더링하지 않고 토큰을 개인 정보가 없는 게스트용으로만 쓰는 것을 전제로 위험을 받아들였습니다. 테스트는 실제 네트워크를 막고 `fetch` 를 스텁해서 씁니다.

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
- `/founder` 는 선택한 업종을 `?category={업종 id}` 로 보관하고(없거나 올바르지 않으면 기본 업종), 순위 행의 리포트 링크에도 같은 쿼리를 붙이고, 동네 리포트(`/founder/areas/:areaId/report`)는 그 값으로 업종을 정합니다(직접 진입한 리포트의 뒤로 가기도 같은 업종의 `/founder` 로 갑니다).
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
    resident-map/  주민 탐색 화면: 지도 필터·마커 규칙(순수 함수), 요청 카드, 데이터 훅. 마커 위치는 자리표시자용 상대좌표(0~1)와 실제 지도용 임시 위경도(`lat`·`lng`, 백엔드 좌표로 교체 예정)를 함께 가진다
    store-request/  가게 요청하기 화면: 선택지 상수, 문장 정리 훅(오래된 응답 무시), 칩 그룹, AI 정리 카드, 제출 가능 여부 규칙
    my-requests/  내 요청 화면: 진행 상황 요약 카드, 요청 카드, 진행률·문구 규칙
    merchant-explore/  사장님 탐색 화면: 반경 칩 옵션, 동네 행, 문구 규칙, 데이터 훅
    founder-explore/  예비 창업자 입지 찾기 화면: 순위 행 문구·지도 알약 규칙(순수 함수, 알약 좌표는 서비스가 준 동네 위경도), 데이터 훅
    founder-report/  창업자 동네 리포트 화면: 요약 카드 문구 규칙, "왜 이 동네인가요?" 카드, 근거 데이터(출처 상수), 데이터 훅
    merchant-area/  사장님 동네 상세 화면: 요약 카드, 막대 행(길이는 데이터에서 계산), 한 줄 요약 카드, 결정 필요 영역, 표시 규칙·데이터 훅
  shared/
    ui/         공통 UI (Text, Button, IconButton, ChoiceChip, ChipGroup, TextArea, Card, ListRowLink, SelectBox, StatCards, ShareButton, Page, AppBar, Notice, BottomNav, MapPlaceholder(자리표시자·폴백), NaverMap(네이버 지도: 마커·중심 핀·반경 원), LogoLink(로고 → 메인 `/`), SampleDataBadge)
    layouts/    MobileLayout(헤더·하단 내비 슬롯), RootLayout·ResidentTabsLayout(라우트용)
    assets/     공통 이미지(로고)
    lib/        경로 상수, useAsyncData, 방문 시간대 표기, 링크 공유(Web Share → 복사), useNaverMapScript(지도 스크립트 한 번만 로드·상태 idle/loading/ready/error)
    styles/     tokens.css(디자인 토큰), fonts.css(@font-face), global.css(reset·전역), fonts/(Pretendard WOFF2·라이선스)
  services/     데이터 접근 인터페이스, 목 구현, api/(fetch 클라이언트·게스트 세션·토큰 보관(localStorage)·오류 코드와 한국어 문구 표·업종 code 별 문구 표·/me·/health·/dongs·/categories 의 DTO·mapper, 인증·me·동네/업종 목록만 API 구현), 인증·내 정보 인터페이스, 입력 문장 정리(키워드 규칙 목)·요청 제출·내 요청 조회·사장님 탐색·동네 상세·창업자 입지 순위(메모리 목) 인터페이스, 동네 상세 한 줄 요약 문장 생성(템플릿 목)과 AI 설명 생성 인터페이스
  mocks/        목 데이터(동네별 시간대·조건 분포는 사장님 상세와 창업자 리포트가 함께 읽는 한 곳), 메모리 DB(요청 제출 시 인원이 늘어나는 상태. 새로고침하면 시드로 초기화)
  types/        공통 도메인 타입
  test/         테스트 설정(네트워크 차단 fetch 스텁 포함)과 renderApp·fetch 스텁 헬퍼
```

`@` 는 `src` 의 별칭이며 `vite.config.ts`(개발·빌드·Vitest 공유)와 `tsconfig.app.json`(타입 검사)에 설정되어 있습니다.

## 모바일 웹 대응

- viewport: `width=device-width, initial-scale=1, viewport-fit=cover` (확대를 막지 않음)
- 콘텐츠 영역은 `--layout-max-width`(430px) 안에서 중앙 정렬하며 높이를 고정하지 않습니다(`100vh` fallback + `100dvh`).
- iOS safe-area(`env(safe-area-inset-*)`) 대응, 하단 내비게이션 높이만큼 본문 여백 확보.
- 입력 필드 글자 크기 16px 이상(iOS 포커스 자동 확대 방지), 주요 터치 영역 최소 44px.
- 한국어 `word-break: keep-all` + 긴 문자열 `overflow-wrap: anywhere`.
- 지도 영역은 너비에 비례(`aspect-ratio`)하고 마커는 영역 대비 비율로 배치해 너비가 달라져도 위치 관계가 유지됩니다. 주민 탐색(`/resident`), 사장님 탐색(`/merchant`), 창업자 입지 찾기(`/founder`)는 `NaverMap` 을 쓰고(사장님 지도는 중심 핀과 실제 반경 원을 함께 그립니다), 키가 없거나 스크립트 로드·인증에 실패하면 같은 자리에 `MapPlaceholder` 가 폴백으로 나옵니다.
- 하단 내비와 그 위에 떠 있는 버튼은 본문 하단 여백을 늘려 마지막 항목을 가리지 않게 합니다.
- 선택 상태는 색상 외에 체크 표시·라디오 선택(`checked`)·`aria-pressed`·`aria-current`·밑줄·굵은 아이콘으로도 전달합니다.

## 개발용 확인 페이지

```bash
pnpm dev   # → http://localhost:5173/dev/design-system
```

색상 스와치와 토큰 이름·값, 타이포그래피, 버튼(기본·disabled·loading), 칩, TextArea(기본·오류), 카드, 긴 한국어 텍스트, 모바일 레이아웃 예시를 보여줍니다. 각 값에 `디자인 시스템 명시` / `화면에서 확인` / `임시` 표시가 붙어 있습니다.

- 개발 환경(`import.meta.env.DEV`)에서만 라우트가 등록되고, 페이지는 `lazy` 로 불러옵니다. 프로덕션 빌드 번들에는 포함되지 않으며 `/dev/design-system` 은 Not Found 로 처리됩니다(빌드 결과에서 문자열 검색으로 확인).
