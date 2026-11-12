/*
 * 내 정보(/me)와 동네 선택(/me/dong) 화면의 문구를 한 곳에 모은다.
 *
 * [확정] 디자인(Figma 41:31, 41:75)에 있는 문구이거나 지시서가 정한 문구
 * [임시] 디자인에 없어 임시로 정한 문구. 확정되면 여기서만 바꾼다.
 *
 * 디자인 주석(동작 설명용 회색 문구)은 화면에 내지 않으므로 여기에 두지 않는다:
 *   - "내 가게"는 사장님일 때만 보여요
 *   - 역할을 바꾸면 그 역할의 첫 화면으로 가요
 *   - {구} {전체}곳 중 6곳 · 아래로 더 있어요
 */
export const MY_INFO_COPY = {
  // [확정]
  title: '내 정보',
  nicknameSuffix: '님',
  idLabel: 'ID : ',
  nicknameNote: '닉네임은 처음 들어올 때 자동으로 정해져요',
  roleLabel: '나는',
  roleGroupLabel: '역할',
  myDong: '내 동네',
  myShop: '내 가게',
  // [확정] Figma 의 예시 값(닉네임이 비어 있을 때의 대체 표시로 쓴다)
  fallbackNickname: '사용자',
  // TODO(디자인 확정 필요): 아래는 임시 문구
  dongEmpty: '정하지 않았어요',
  /** 사장님인데 가게가 아직 없을 때 "내 가게" 행의 값. 누르면 가게 등록 화면(/me/shop)으로 간다. */
  shopEmpty: '등록하기',
  loadFailedTitle: '내 정보를 가져오지 못했어요',
  needsDong: '동네를 먼저 정해 주세요.',
  needsRole: '역할을 먼저 정해 주세요.',
} as const;

export const DONG_SELECT_COPY = {
  // [확정]
  title: '동네 선택',
  searchPlaceholder: '동 이름 (예: 구성)',
  confirm: '이 동네로 정하기',
  // 접근성 이름(화면에 보이지 않는다)
  searchLabel: '동 이름 검색',
  districtGroupLabel: '구 선택',
  listLabel: '동 목록',
  // TODO(디자인 확정 필요): 아래는 임시 문구
  /** 검색·구 필터 결과가 없을 때(디자인에 없다) */
  noResults: '찾는 동네가 없어요',
  listLoading: '불러오는 중이에요.',
  listFailed: '동네 목록을 불러오지 못했어요. 새로고침해 주세요.',
} as const;

/**
 * 내 가게(/me/shop) 화면 문구. 디자인 주석 "위치로 동네를 자동으로 찾아요 → {구} {동}"(Figma 41:121)은
 * 동작 설명용이라 화면에 내지 않는다(동네는 서버가 좌표로 찾는다). 여기에 두지 않는다.
 */
export const SHOP_COPY = {
  // [확정] Figma 41:121
  title: '내 가게',
  nameLabel: '가게 이름',
  categoryLabel: '업종',
  locationLabel: '가게 위치',
  addressLabel: '또는 주소로 찾기',
  addressPlaceholder: '예 : 마북로 123',
  save: '저장하기',
  // 접근성 이름(화면에 보이지 않는다)
  mapLabel: '가게 위치 지도. 지도를 움직여 가운데 핀이 가리키는 곳을 정해요',
  // TODO(디자인 확정 필요): 아래는 임시 문구
  /** 업종 select 에서 아직 고르지 않았을 때(디자인에는 선택된 값만 있다) */
  categoryPlaceholder: '업종을 골라 주세요',
  addressNotFound: '주소를 찾지 못했어요',
  mapFailed: '지도를 불러오지 못했어요',
  mapLoading: '지도를 불러오는 중이에요.',
  loading: '불러오는 중이에요.',
  categoriesFailed: '업종 목록을 불러오지 못했어요. 새로고침해 주세요.',
} as const;
