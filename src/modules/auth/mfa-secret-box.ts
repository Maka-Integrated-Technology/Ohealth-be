import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Versioned AES-GCM envelope. The wrapping key comes from managed deployment configuration. */
@Injectable()
export class MfaSecretBox {
  constructor(private readonly config: ConfigService) {}

  encrypt(secret: string): string {
    const dataKey = randomBytes(32);
    const dataIv = randomBytes(12);
    const wrappingIv = randomBytes(12);
    const dataCipher = createCipheriv('aes-256-gcm', dataKey, dataIv);
    const ciphertext = Buffer.concat([
      dataCipher.update(secret, 'utf8'),
      dataCipher.final(),
    ]);
    const wrappingCipher = createCipheriv(
      'aes-256-gcm',
      this.key(),
      wrappingIv,
    );
    const wrappedKey = Buffer.concat([
      wrappingCipher.update(dataKey),
      wrappingCipher.final(),
    ]);
    dataKey.fill(0);
    return [
      'v1',
      wrappingIv.toString('base64url'),
      wrappedKey.toString('base64url'),
      wrappingCipher.getAuthTag().toString('base64url'),
      dataIv.toString('base64url'),
      ciphertext.toString('base64url'),
      dataCipher.getAuthTag().toString('base64url'),
    ].join('.');
  }

  decrypt(envelope: string): string {
    const parts = envelope.split('.');
    if (parts.length !== 7 || parts[0] !== 'v1') {
      throw new Error('Invalid MFA envelope.');
    }
    const [, wrappingIv, wrappedKey, wrappingTag, dataIv, ciphertext, dataTag] =
      parts.map((part) => Buffer.from(part, 'base64url'));
    const unwrap = createDecipheriv('aes-256-gcm', this.key(), wrappingIv);
    unwrap.setAuthTag(wrappingTag);
    const dataKey = Buffer.concat([unwrap.update(wrappedKey), unwrap.final()]);
    try {
      const decipher = createDecipheriv('aes-256-gcm', dataKey, dataIv);
      decipher.setAuthTag(dataTag);
      return Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]).toString('utf8');
    } finally {
      dataKey.fill(0);
    }
  }

  private key(): Buffer {
    const encoded = this.config.get<string>('MFA_ENCRYPTION_KEY');
    const key = Buffer.from(encoded ?? '', 'base64');
    if (key.length !== 32 || key.toString('base64') !== encoded) {
      throw new Error(
        'MFA_ENCRYPTION_KEY must be a base64 encoded 32-byte key.',
      );
    }
    return key;
  }
}
