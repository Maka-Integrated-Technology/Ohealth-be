import { createRequire } from 'node:module';

import { IMulterFile } from '../../../common/types';

import {
  MAX_PROFILE_PHOTO_EDGE,
  MAX_PROFILE_PHOTO_INPUT_BYTES,
  normalizeProfilePhoto,
} from './profile-photo-image';

import type sharpModule from 'sharp';

const sharp: typeof sharpModule = createRequire(__filename)('sharp');

const file = (buffer: Buffer, mimetype: string): IMulterFile => ({
  fieldname: 'file',
  originalname: 'ignored',
  encoding: '7bit',
  mimetype,
  size: buffer.length,
  buffer,
});

describe('profile photo image validation', () => {
  it.each([
    ['image/jpeg', 'jpeg'],
    ['image/png', 'png'],
    ['image/webp', 'webp'],
  ] as const)(
    'accepts and normalizes %s without metadata',
    async (mime, format) => {
      const source = await sharp({
        create: { width: 2, height: 3, channels: 3, background: 'red' },
      })
        .withMetadata({ exif: { IFD0: { Copyright: 'private' } } })
        [format]()
        .toBuffer();
      const result = await normalizeProfilePhoto(file(source, mime));
      const metadata = await sharp(result.body).metadata();
      expect(result).toMatchObject({
        contentType: 'image/jpeg',
        width: 2,
        height: 3,
      });
      expect(metadata.exif).toBeUndefined();
      expect(metadata.icc).toBeUndefined();
      expect(result.sha256).toMatch(/^[a-f0-9]{64}$/);
    },
  );

  it('rejects mismatched MIME, scripts, and trailing polyglot bytes', async () => {
    const png = await sharp({
      create: { width: 1, height: 1, channels: 3, background: 'blue' },
    })
      .png()
      .toBuffer();
    await expect(
      normalizeProfilePhoto(file(png, 'image/jpeg')),
    ).rejects.toThrow();
    await expect(
      normalizeProfilePhoto({
        ...file(png, 'image/png'),
        originalname: 'photo.jpg',
      }),
    ).rejects.toThrow();
    await expect(
      normalizeProfilePhoto(file(Buffer.from('<svg/>'), 'image/svg+xml')),
    ).rejects.toThrow();
    await expect(
      normalizeProfilePhoto(
        file(Buffer.concat([png, Buffer.from('<script>')]), 'image/png'),
      ),
    ).rejects.toThrow();
    await expect(
      normalizeProfilePhoto(file(Buffer.from('MZ'), 'image/png')),
    ).rejects.toThrow();
  });

  it('rejects truncated containers and too many bytes or dimensions', async () => {
    const jpeg = await sharp({
      create: { width: 1, height: 1, channels: 3, background: 'blue' },
    })
      .jpeg()
      .toBuffer();
    await expect(
      normalizeProfilePhoto(file(jpeg.subarray(0, -2), 'image/jpeg')),
    ).rejects.toThrow();
    await expect(
      normalizeProfilePhoto(
        file(Buffer.alloc(MAX_PROFILE_PHOTO_INPUT_BYTES + 1), 'image/png'),
      ),
    ).rejects.toThrow();
    const huge = await sharp({
      create: {
        width: MAX_PROFILE_PHOTO_EDGE + 1,
        height: 1,
        channels: 3,
        background: 'blue',
      },
    })
      .png()
      .toBuffer();
    await expect(
      normalizeProfilePhoto(file(huge, 'image/png')),
    ).rejects.toThrow();
  });

  it('rejects the WebP animation flag', async () => {
    const still = await sharp({
      create: { width: 2, height: 2, channels: 4, background: 'red' },
    })
      .webp()
      .toBuffer();
    const vp8x = Buffer.alloc(18);
    vp8x.write('VP8X');
    vp8x.writeUInt32LE(10, 4);
    vp8x[8] = 0x02;
    const animated = Buffer.concat([
      still.subarray(0, 12),
      vp8x,
      still.subarray(12),
    ]);
    animated.writeUInt32LE(animated.length - 8, 4);
    await expect(
      normalizeProfilePhoto(file(animated, 'image/webp')),
    ).rejects.toThrow();
  });
});
