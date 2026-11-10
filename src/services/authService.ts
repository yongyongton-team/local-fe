/**
 * 인증 경계. 게스트 로그인과, 시연용 사장님 데모 로그인이 있다.
 * - mock: 아무것도 하지 않는다(네트워크·로그인 없음). 데모 로그인은 항상 꺼짐.
 * - api: 토큰이 없을 때만 /auth/guest 로 로그인하고 토큰을 localStorage 와 메모리에 보관한다.
 * 데이터 요청은 필요할 때 스스로 로그인한다(지연 로그인)라서 화면이 이 서비스를 직접 부를 일은 드물다.
 */
export interface AuthService {
  /** 세션(토큰)이 없으면 게스트 로그인한다. 동시에 여러 번 불러도 로그인은 한 번이다. */
  ensureSession(): Promise<void>;
  /** 저장된 세션을 지운다. 다음 요청에서 다시 로그인한다. */
  clearSession(): void;
  /**
   * 시연용 데모 진입(/?demo=owner)을 쓸 수 있는지. API 모드이고 VITE_ENABLE_DEMO_LOGIN=true 일 때만 true 다.
   * false 이면 화면은 demo 쿼리 파라미터를 완전히 무시한다.
   */
  readonly demoLoginEnabled: boolean;
  /** 사장님 데모 계정(POST /auth/demo)으로 로그인한다. 서버에 쓰지 않는다. demoLoginEnabled 가 false 면 던진다. */
  startDemoSession(): Promise<void>;
  /** 데모 세션을 끝낸다: 토큰과 데모 표시를 지운다. 다음 요청에서 새 게스트가 된다. */
  endDemoSession(): void;
  /** 지금 세션이 데모 세션인지(요청 없음). 데모 세션에서는 서버에 쓰는 호출을 막는다. */
  isDemoSession(): boolean;
}
