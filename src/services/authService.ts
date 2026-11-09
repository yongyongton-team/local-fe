/**
 * 인증 경계. 지금은 게스트 로그인뿐이다(데모 로그인은 아직 없다).
 * - mock: 아무것도 하지 않는다(네트워크·로그인 없음).
 * - api: 토큰이 없을 때만 /auth/guest 로 로그인하고 토큰을 sessionStorage 와 메모리에 보관한다.
 * 데이터 요청은 필요할 때 스스로 로그인한다(지연 로그인)라서 화면이 이 서비스를 직접 부를 일은 드물다.
 */
export interface AuthService {
  /** 세션(토큰)이 없으면 게스트 로그인한다. 동시에 여러 번 불러도 로그인은 한 번이다. */
  ensureSession(): Promise<void>;
  /** 저장된 세션을 지운다. 다음 요청에서 다시 로그인한다. */
  clearSession(): void;
}
