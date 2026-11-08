import { afterEach, describe, expect, it, vi } from 'vitest';
import { shareLink } from './share';

const content = {
  text: '구성동에서 빵집을 원하는 주민이 6명이 됐어요.',
  url: 'https://example.com/',
};

function stub(name: 'share' | 'clipboard', value: unknown) {
  Object.defineProperty(navigator, name, { value, configurable: true, writable: true });
}

afterEach(() => {
  // jsdom 에는 기본으로 없는 속성이므로 지워서 원래 상태로 되돌린다.
  Reflect.deleteProperty(navigator, 'share');
  Reflect.deleteProperty(navigator, 'clipboard');
});

describe('shareLink', () => {
  it('Web Share 를 지원하면 문구와 링크로 공유한다', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const writeText = vi.fn();
    stub('share', share);
    stub('clipboard', { writeText });

    await expect(shareLink(content)).resolves.toBe('shared');

    expect(share).toHaveBeenCalledWith(content);
    expect(writeText).not.toHaveBeenCalled();
  });

  it('사용자가 공유를 취소하면 cancelled 이고 복사하지 않는다', async () => {
    const writeText = vi.fn();
    stub('share', vi.fn().mockRejectedValue(new DOMException('canceled', 'AbortError')));
    stub('clipboard', { writeText });

    await expect(shareLink(content)).resolves.toBe('cancelled');

    expect(writeText).not.toHaveBeenCalled();
  });

  it('Web Share 를 지원하지 않으면 링크를 클립보드에 복사한다', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stub('clipboard', { writeText });

    await expect(shareLink(content)).resolves.toBe('copied');

    expect(writeText).toHaveBeenCalledWith('https://example.com/');
  });

  it('공유가 취소가 아닌 이유로 실패하면 복사로 대신한다', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stub('share', vi.fn().mockRejectedValue(new DOMException('denied', 'NotAllowedError')));
    stub('clipboard', { writeText });

    await expect(shareLink(content)).resolves.toBe('copied');
  });

  it('복사에도 실패하면 failed 이다', async () => {
    stub('clipboard', { writeText: vi.fn().mockRejectedValue(new Error('denied')) });

    await expect(shareLink(content)).resolves.toBe('failed');
  });

  it('클립보드를 쓸 수 없는 환경(clipboard 없음)이면 failed 이다', async () => {
    await expect(shareLink(content)).resolves.toBe('failed');
  });
});
