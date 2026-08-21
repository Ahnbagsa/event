import { describe, it, expect } from 'vitest';
import { fileToInline, ACCEPTED_PLAN_TYPES } from './fileToInline';

describe('fileToInline', () => {
  it('파일을 base64로 바꾼다', async () => {
    const file = new File([new Uint8Array([72, 105])], '계획서.pdf', { type: 'application/pdf' });
    const result = await fileToInline(file);
    expect(result.mimeType).toBe('application/pdf');
    expect(result.base64).toBe('SGk=');
  });

  it('빈 파일도 처리한다', async () => {
    const file = new File([], '빈파일.pdf', { type: 'application/pdf' });
    expect((await fileToInline(file)).base64).toBe('');
  });

  it('지원하지 않는 형식은 오류를 던진다', async () => {
    const file = new File(['내용'], '계획서.hwp', { type: 'application/x-hwp' });
    await expect(fileToInline(file)).rejects.toThrow(
      '한글(hwp) 파일은 읽을 수 없습니다',
    );
  });

  it('20MB를 넘으면 오류를 던진다', async () => {
    const big = new File([new Uint8Array(21 * 1024 * 1024)], '큰파일.pdf', {
      type: 'application/pdf',
    });
    await expect(fileToInline(big)).rejects.toThrow('파일이 너무 큽니다');
  });

  it('PDF와 주요 이미지 형식을 허용한다', () => {
    expect(ACCEPTED_PLAN_TYPES).toContain('application/pdf');
    expect(ACCEPTED_PLAN_TYPES).toContain('image/jpeg');
  });
});
