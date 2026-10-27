import { BadRequestException } from '@nestjs/common';

import { UpdatePatientPersonalProfileDto } from './patient-personal-profile.dto';

export interface INormalizedPatientPersonalUpdate {
  first_name?: string;
  last_name?: string;
  middle_name?: string | null;
  gender?: string | null;
  dob?: string | null;
  country?: string | null;
  address?: string | null;
}

const FIELDS = new Set([
  'first_name',
  'last_name',
  'middle_name',
  'gender',
  'dob',
  'country',
  'address',
]);

export function normalizePatientPersonalUpdate(
  dto: UpdatePatientPersonalProfileDto,
): INormalizedPatientPersonalUpdate {
  if (!dto || typeof dto !== 'object') {
    throw new BadRequestException('Invalid personal profile update.');
  }
  const fields = dto as Record<string, unknown>;
  if (Object.keys(fields).some((key) => !FIELDS.has(key))) {
    throw new BadRequestException(
      'Protected profile fields cannot be changed here.',
    );
  }
  const normalized: INormalizedPatientPersonalUpdate = {};
  for (const key of ['first_name', 'last_name'] as const) {
    const value = fields[key];
    if (value === undefined) continue;
    if (
      typeof value !== 'string' ||
      !value.trim() ||
      value.trim().length > 100
    ) {
      throw new BadRequestException(`${key} must contain 1–100 characters.`);
    }
    normalized[key] = value.trim();
  }
  for (const key of ['middle_name', 'country', 'address'] as const) {
    const value = fields[key];
    if (value === undefined) continue;
    const maxLength = key === 'address' ? 500 : 100;
    if (
      value !== null &&
      (typeof value !== 'string' || value.trim().length > maxLength)
    ) {
      throw new BadRequestException(`${key} exceeds the accepted length.`);
    }
    normalized[key] = typeof value === 'string' ? value.trim() || null : null;
  }
  if (fields.gender !== undefined) {
    if (
      fields.gender !== null &&
      !['Male', 'Female', 'Other'].includes(String(fields.gender))
    ) {
      throw new BadRequestException('Unsupported gender.');
    }
    normalized.gender = fields.gender as string | null;
  }
  if (fields.dob !== undefined) {
    const value = fields.dob;
    if (value !== null) {
      if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        throw new BadRequestException('Date of birth must be YYYY-MM-DD.');
      }
      const parsed = new Date(value + 'T00:00:00.000Z');
      if (
        Number.isNaN(parsed.getTime()) ||
        parsed.toISOString().slice(0, 10) !== value ||
        parsed.getTime() > Date.now()
      ) {
        throw new BadRequestException('Invalid date of birth.');
      }
    }
    normalized.dob = value as string | null;
  }
  return normalized;
}
