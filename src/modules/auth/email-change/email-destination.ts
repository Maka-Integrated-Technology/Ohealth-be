import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface IEncryptedEmail {
  destination_iv: string;
  destination_ciphertext: string;
  destination_tag: string;
}

/** Uses the existing challenge-delivery key, with a separate email-change context. */
@Injectable()
export class EmailDestinationService {
  constructor(private readonly config: ConfigService) {}

  private key(): Buffer {
    const encoded = this.config.get<string>('AUTH_CHALLENGE_DELIVERY_KEY');
    if (!encoded || !/^[A-Za-z0-9+/]{43}=$/.test(encoded))
      throw new Error(
        'AUTH_CHALLENGE_DELIVERY_KEY must be a base64-encoded 32-byte key.',
      );
    const key = Buffer.from(encoded, 'base64');
    if (key.length !== 32 || key.toString('base64') !== encoded)
      throw new Error('Invalid challenge delivery key.');
    return key;
  }

  hash(email: string): string {
    return createHmac('sha256', this.key())
      .update('ohealth:email-change:v1:')
      .update(email, 'utf8')
      .digest('hex');
  }

  encrypt(lineageId: string, email: string): IEncryptedEmail {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key(), iv);
    cipher.setAAD(Buffer.from(`ohealth:email-change:v1:${lineageId}`));
    const ciphertext = Buffer.concat([
      cipher.update(email, 'utf8'),
      cipher.final(),
    ]);
    return {
      destination_iv: iv.toString('hex'),
      destination_ciphertext: ciphertext.toString('hex'),
      destination_tag: cipher.getAuthTag().toString('hex'),
    };
  }

  decrypt(lineageId: string, envelope: IEncryptedEmail): string {
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.key(),
      Buffer.from(envelope.destination_iv, 'hex'),
    );
    decipher.setAAD(Buffer.from(`ohealth:email-change:v1:${lineageId}`));
    decipher.setAuthTag(Buffer.from(envelope.destination_tag, 'hex'));
    return Buffer.concat([
      decipher.update(Buffer.from(envelope.destination_ciphertext, 'hex')),
      decipher.final(),
    ]).toString('utf8');
  }
}
