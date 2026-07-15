import * as path from 'path';

import {
  BadRequestException,
  Injectable,
  PayloadTooLargeException,
} from '@nestjs/common';

import { IMulterFile } from '../../common/types';
import {
  ALLOWED_LAB_VERIFICATION_DOCUMENT_MIME_TYPES,
  MAX_LAB_VERIFICATION_DOCUMENT_SIZE,
} from '../../constants/file-upload.constants';

interface IValidatedLaboratoryVerificationDocumentFile {
  extension: string;
  mimeType: string;
}

const MIME_TYPE_EXTENSIONS = new Map<string, readonly string[]>([
  ['application/pdf', ['.pdf']],
  ['image/jpeg', ['.jpg', '.jpeg']],
  ['image/png', ['.png']],
  ['image/webp', ['.webp']],
]);

@Injectable()
export class LaboratoryVerificationDocumentFileValidator {
  validate(file?: IMulterFile): IValidatedLaboratoryVerificationDocumentFile {
    if (!file) {
      throw new BadRequestException('verification document file is required');
    }

    if (
      file.size > MAX_LAB_VERIFICATION_DOCUMENT_SIZE ||
      file.buffer?.length > MAX_LAB_VERIFICATION_DOCUMENT_SIZE
    ) {
      throw new PayloadTooLargeException(
        `file size must not exceed ${MAX_LAB_VERIFICATION_DOCUMENT_SIZE} bytes`,
      );
    }

    if (!Buffer.isBuffer(file.buffer) || file.size < 1 || !file.buffer.length) {
      throw new BadRequestException(
        'verification document file must not be empty',
      );
    }

    const declaredMimeType = this.normalizeMimeType(file.mimetype);
    const declaredMimeTypeExtensions =
      MIME_TYPE_EXTENSIONS.get(declaredMimeType);
    if (
      !ALLOWED_LAB_VERIFICATION_DOCUMENT_MIME_TYPES.includes(file.mimetype) ||
      !declaredMimeTypeExtensions
    ) {
      throw new BadRequestException('unsupported verification document type');
    }

    const detectedMimeType = this.detectMimeType(file.buffer);
    if (!detectedMimeType || detectedMimeType !== declaredMimeType) {
      throw new BadRequestException(
        'file content does not match its declared verification document type',
      );
    }

    const extension = path.extname(file.originalname || '').toLowerCase();
    const detectedMimeTypeExtensions =
      MIME_TYPE_EXTENSIONS.get(detectedMimeType);
    if (!detectedMimeTypeExtensions?.includes(extension)) {
      throw new BadRequestException(
        'file extension does not match its verification document type',
      );
    }

    return {
      extension: detectedMimeTypeExtensions[0],
      mimeType: detectedMimeType,
    };
  }

  private normalizeMimeType(mimeType: string): string {
    return mimeType === 'image/jpg' ? 'image/jpeg' : mimeType;
  }

  private detectMimeType(buffer: Buffer): string | undefined {
    if (this.hasPrefix(buffer, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
      return 'application/pdf';
    }

    if (this.hasPrefix(buffer, [0xff, 0xd8, 0xff])) {
      return 'image/jpeg';
    }

    if (
      this.hasPrefix(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    ) {
      return 'image/png';
    }

    if (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    ) {
      return 'image/webp';
    }

    return undefined;
  }

  private hasPrefix(buffer: Buffer, signature: readonly number[]): boolean {
    return (
      buffer.length >= signature.length &&
      signature.every((byte, index) => buffer[index] === byte)
    );
  }
}
