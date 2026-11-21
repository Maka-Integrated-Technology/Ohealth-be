import { createHash } from 'crypto';
import { createRequire } from 'node:module';
import { extname } from 'node:path';

import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';

import { IMulterFile } from '../../../common/types';

import type sharpModule from 'sharp';

const sharp: typeof sharpModule = createRequire(__filename)('sharp');

export const MAX_PROFILE_PHOTO_INPUT_BYTES = 5 * 1024 * 1024;
export const MAX_PROFILE_PHOTO_OUTPUT_BYTES = 5 * 1024 * 1024;
export const MAX_PROFILE_PHOTO_EDGE = 4096;
export const MAX_PROFILE_PHOTO_PIXELS = 16_000_000;
export const PROFILE_PHOTO_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export interface INormalizedProfilePhoto {
  body: Buffer;
  contentType: 'image/jpeg' | 'image/png' | 'image/webp';
  width: number;
  height: number;
  sha256: string;
}

function malformed(): never {
  throw new BadRequestException('Invalid profile photo.');
}

function assertPngComplete(bytes: Buffer): void {
  let cursor = 8;
  let seenIend = false;
  while (cursor + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(cursor);
    const end = cursor + 12 + length;
    if (end > bytes.length) malformed();
    const type = bytes.toString('ascii', cursor + 4, cursor + 8);
    if (type === 'acTL') malformed();
    if (type === 'IEND') {
      if (length !== 0 || end !== bytes.length) malformed();
      seenIend = true;
      break;
    }
    cursor = end;
  }
  if (!seenIend) malformed();
}

function assertJpegComplete(bytes: Buffer): void {
  let cursor = 2;
  let inScan = false;
  while (cursor < bytes.length) {
    if (inScan) {
      while (cursor < bytes.length && bytes[cursor] !== 0xff) cursor++;
      if (cursor + 1 >= bytes.length) malformed();
      const marker = bytes[cursor + 1];
      if (
        marker === 0x00 ||
        marker === 0xff ||
        (marker >= 0xd0 && marker <= 0xd7)
      ) {
        cursor += 2;
        continue;
      }
      inScan = false;
    }
    if (bytes[cursor] !== 0xff || cursor + 1 >= bytes.length) malformed();
    while (bytes[cursor + 1] === 0xff) cursor++;
    const marker = bytes[cursor + 1];
    cursor += 2;
    if (marker === 0xd9) {
      if (cursor !== bytes.length) malformed();
      return;
    }
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7)) malformed();
    if (cursor + 2 > bytes.length) malformed();
    const segmentLength = bytes.readUInt16BE(cursor);
    if (segmentLength < 2 || cursor + segmentLength > bytes.length) malformed();
    cursor += segmentLength;
    if (marker === 0xda) inScan = true;
  }
  malformed();
}

function assertContainer(bytes: Buffer, mime: string): void {
  if (mime === 'image/png') {
    if (
      bytes.length < 20 ||
      !bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))
    )
      malformed();
    assertPngComplete(bytes);
  } else if (mime === 'image/webp') {
    if (
      bytes.length < 20 ||
      bytes.toString('ascii', 0, 4) !== 'RIFF' ||
      bytes.toString('ascii', 8, 12) !== 'WEBP' ||
      bytes.readUInt32LE(4) + 8 !== bytes.length
    )
      malformed();
    let cursor = 12;
    while (cursor + 8 <= bytes.length) {
      const kind = bytes.toString('ascii', cursor, cursor + 4);
      const size = bytes.readUInt32LE(cursor + 4);
      if (
        kind === 'ANIM' ||
        kind === 'ANMF' ||
        (kind === 'VP8X' && (bytes[cursor + 8] & 0x02) !== 0)
      )
        malformed();
      cursor += 8 + size + (size % 2);
      if (cursor > bytes.length) malformed();
    }
    if (cursor !== bytes.length) malformed();
  } else if (mime === 'image/jpeg') {
    if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) malformed();
    assertJpegComplete(bytes);
  } else {
    malformed();
  }
}

export async function normalizeProfilePhoto(
  file: IMulterFile,
): Promise<INormalizedProfilePhoto> {
  if (
    !file ||
    !Buffer.isBuffer(file.buffer) ||
    !PROFILE_PHOTO_MIME_TYPES.includes(file.mimetype as never)
  )
    malformed();
  if (file.buffer.length > MAX_PROFILE_PHOTO_INPUT_BYTES)
    throw new PayloadTooLargeException('Profile photo exceeds size limit.');
  if (file.buffer.length === 0) malformed();
  const extension = extname(file.originalname ?? '').toLowerCase();
  const allowedExtension =
    file.mimetype === 'image/jpeg'
      ? ['.jpg', '.jpeg']
      : file.mimetype === 'image/png'
        ? ['.png']
        : ['.webp'];
  if (extension && !allowedExtension?.includes(extension)) malformed();
  assertContainer(file.buffer, file.mimetype);
  try {
    const decoder = sharp(file.buffer, {
      failOn: 'warning',
      limitInputPixels: MAX_PROFILE_PHOTO_PIXELS,
      animated: false,
    });
    const meta = await decoder.metadata();
    const expectedFormat = file.mimetype.slice('image/'.length);
    if (
      meta.format !== expectedFormat ||
      (meta.pages !== undefined && meta.pages !== 1) ||
      !meta.width ||
      !meta.height ||
      meta.width > MAX_PROFILE_PHOTO_EDGE ||
      meta.height > MAX_PROFILE_PHOTO_EDGE ||
      meta.width * meta.height > MAX_PROFILE_PHOTO_PIXELS
    )
      malformed();
    const output = await sharp(file.buffer, {
      failOn: 'warning',
      limitInputPixels: MAX_PROFILE_PHOTO_PIXELS,
      animated: false,
    })
      .rotate()
      .toColourspace('srgb')
      .jpeg({ quality: 85, progressive: false })
      .toBuffer({ resolveWithObject: true });
    if (output.data.length > MAX_PROFILE_PHOTO_OUTPUT_BYTES)
      throw new PayloadTooLargeException(
        'Normalized profile photo exceeds size limit.',
      );
    return {
      body: output.data,
      contentType: 'image/jpeg',
      width: output.info.width,
      height: output.info.height,
      sha256: createHash('sha256').update(output.data).digest('hex'),
    };
  } catch (error) {
    if (
      error instanceof PayloadTooLargeException ||
      error instanceof BadRequestException
    )
      throw error;
    malformed();
  }
}
