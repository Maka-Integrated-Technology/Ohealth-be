/* eslint-disable @typescript-eslint/naming-convention */
import { ConfigService } from '@nestjs/config';

import { MfaSecretBox } from './mfa-secret-box';

describe('MfaSecretBox', () => {
  const key = Buffer.alloc(32, 7).toString('base64');
  const box = new MfaSecretBox(new ConfigService({ MFA_ENCRYPTION_KEY: key }));

  it('uses a randomized authenticated envelope and decrypts it', () => {
    const first = box.encrypt('JBSWY3DPEHPK3PXP');
    const second = box.encrypt('JBSWY3DPEHPK3PXP');

    expect(first).not.toBe(second);
    expect(first).not.toContain('JBSWY3DPEHPK3PXP');
    expect(box.decrypt(first)).toBe('JBSWY3DPEHPK3PXP');
  });

  it('rejects tampering and invalid key configuration', () => {
    const envelope = box.encrypt('JBSWY3DPEHPK3PXP');
    const parts = envelope.split('.');
    parts[5] = Buffer.from('tampered').toString('base64url');

    expect(() => box.decrypt(parts.join('.'))).toThrow();
    expect(() =>
      new MfaSecretBox(
        new ConfigService({ MFA_ENCRYPTION_KEY: 'not-a-key' }),
      ).encrypt('secret'),
    ).toThrow('MFA_ENCRYPTION_KEY');
  });
});
