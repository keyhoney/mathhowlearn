import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { normalizeAuthError } from './auth-page';

describe('normalizeAuthError', () => {
  it('maps firebase auth codes to korean messages', () => {
    assert.match(
      normalizeAuthError({ code: 'auth/invalid-credential' }),
      /이메일 또는 비밀번호/,
    );
    assert.match(
      normalizeAuthError({ code: 'auth/email-already-in-use' }),
      /이미 사용 중인 이메일/,
    );
    assert.match(normalizeAuthError(new Error('auth/not-configured')), /Firebase 인증 설정/);
  });
});
