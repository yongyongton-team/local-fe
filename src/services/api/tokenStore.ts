/** 저장하는 세션. 토큰 값은 로그·콘솔·오류 메시지에 출력하지 않는다. */
export interface StoredSession {
  token: string;
  /** 만료 시각(epoch ms). 알 수 없으면 undefined(서버가 401 로 알려 줄 때까지 쓴다) */
  expiresAt?: number;
}

export interface TokenStore {
  /** 만료된 세션은 지우고 null 을 돌려준다. */
  read(now?: number): StoredSession | null;
  write(session: StoredSession): void;
  clear(): void;
}

/**
 * localStorage 의 키. 게스트는 토큰을 잃으면 새 사용자가 되어 내 요청이 사라진다(서버가 로그인마다 새 사용자를 만든다).
 * 토큰이 30일이라 탭을 닫아도 남는 localStorage 에 둔다.
 */
const STORAGE_KEY = 'yyt.session';

function isStoredSession(value: unknown): value is StoredSession {
  if (typeof value !== 'object' || value === null) return false;
  const { token, expiresAt } = value as Record<string, unknown>;
  return (
    typeof token === 'string' &&
    token !== '' &&
    (expiresAt === undefined || (typeof expiresAt === 'number' && Number.isFinite(expiresAt)))
  );
}

/**
 * 토큰 보관소: 메모리가 기준이고 localStorage 에도 복사해 새로고침·탭을 닫은 뒤에도 복원한다.
 * localStorage 접근이 막혀 있어도(예외) 메모리만으로 동작한다. 저장소 접근은 모두 try/catch 로 감싼다.
 * 보안: localStorage 는 같은 출처의 스크립트(XSS)가 읽을 수 있다. 이 앱은 사용자 입력을 HTML 로 렌더링하지 않고 토큰은
 * 개인 정보가 없는 게스트용이라 이 위험을 받아들인다.
 * @param getStorage 테스트에서 저장소를 바꿔 끼우는 용도. 기본은 window.localStorage.
 */
export function createTokenStore(
  getStorage: () => Storage = () => window.localStorage,
): TokenStore {
  let memory: StoredSession | null = null;
  let restored = false;

  function restore() {
    if (restored) return;
    restored = true;
    try {
      const raw = getStorage().getItem(STORAGE_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (isStoredSession(parsed)) memory = parsed;
      }
    } catch {
      // 저장소를 못 읽거나 내용이 깨졌으면 세션이 없는 것으로 본다.
    }
  }

  function persist(session: StoredSession | null) {
    try {
      const storage = getStorage();
      if (session) storage.setItem(STORAGE_KEY, JSON.stringify(session));
      else storage.removeItem(STORAGE_KEY);
    } catch {
      // 저장하지 못해도 메모리로 계속 동작한다.
    }
  }

  return {
    read(now = Date.now()) {
      restore();
      if (memory && memory.expiresAt !== undefined && memory.expiresAt <= now) {
        memory = null;
        persist(null);
      }
      return memory;
    },
    write(session) {
      restored = true;
      memory = session;
      persist(session);
    },
    clear() {
      restored = true;
      memory = null;
      persist(null);
    },
  };
}
