import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';

import { IMulterFile } from '../../common/types';
import { MAX_LAB_VERIFICATION_DOCUMENT_SIZE } from '../../constants/file-upload.constants';

import { LaboratoryVerificationDocumentFileValidator } from './laboratory-verification-document-file.validator';

describe('LaboratoryVerificationDocumentFileValidator', () => {
  const validator = new LaboratoryVerificationDocumentFileValidator();

  const createFile = (
    originalname: string,
    mimetype: string,
    buffer: Buffer,
  ): IMulterFile => ({
    fieldname: 'file',
    originalname,
    encoding: '7bit',
    mimetype,
    size: buffer.length,
    buffer,
  });

  it.each([
    {
      filename: 'license.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.7\n'),
      expectedExtension: '.pdf',
    },
    {
      filename: 'certificate.jpeg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
      expectedExtension: '.jpg',
    },
    {
      filename: 'registration.png',
      mimeType: 'image/png',
      buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      expectedExtension: '.png',
    },
    {
      filename: 'identity.webp',
      mimeType: 'image/webp',
      buffer: Buffer.from('RIFF0000WEBP', 'ascii'),
      expectedExtension: '.webp',
    },
  ])(
    'should accept a valid $mimeType document',
    ({ filename, mimeType, buffer, expectedExtension }) => {
      expect(
        validator.validate(createFile(filename, mimeType, buffer)),
      ).toEqual({
        extension: expectedExtension,
        mimeType,
      });
    },
  );

  it('should normalize the image/jpg MIME alias', () => {
    const file = createFile(
      'identity.jpg',
      'image/jpg',
      Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
    );

    expect(validator.validate(file)).toEqual({
      extension: '.jpg',
      mimeType: 'image/jpeg',
    });
  });

  it('should reject content that does not match the declared MIME type', () => {
    const file = createFile(
      'malware.pdf',
      'application/pdf',
      Buffer.from('not-a-pdf'),
    );

    expect(() => validator.validate(file)).toThrow(BadRequestException);
  });

  it('should reject an extension that does not match the detected content', () => {
    const file = createFile(
      'malware.exe',
      'application/pdf',
      Buffer.from('%PDF-1.7\n'),
    );

    expect(() => validator.validate(file)).toThrow(BadRequestException);
  });

  it('should reject empty and oversized files', () => {
    expect(() =>
      validator.validate(
        createFile('empty.pdf', 'application/pdf', Buffer.alloc(0)),
      ),
    ).toThrow(BadRequestException);

    const oversizedFile = createFile(
      'large.pdf',
      'application/pdf',
      Buffer.from('%PDF-1.7\n'),
    );
    oversizedFile.size = MAX_LAB_VERIFICATION_DOCUMENT_SIZE + 1;

    expect(() => validator.validate(oversizedFile)).toThrow(
      PayloadTooLargeException,
    );
  });
});
