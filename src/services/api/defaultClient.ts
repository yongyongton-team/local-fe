import { createApiClient, type ApiClient } from './apiClient';
import { readApiBaseUrl } from './config';

let client: ApiClient | null = null;

/**
 * 앱이 쓰는 API 클라이언트(처음 쓸 때 만든다). VITE_API_BASE_URL 이 없거나 잘못되면 첫 호출에서 ApiError 를 던진다.
 * import 만으로는 환경 변수를 읽지도 네트워크를 쓰지도 않는다.
 */
export function getApiClient(): ApiClient {
  client ??= createApiClient({ baseUrl: readApiBaseUrl() });
  return client;
}

/** 테스트 전용: 만들어 둔 클라이언트를 버린다. */
export function resetApiClientForTests(): void {
  client = null;
}
