/**
 * File upload constants
 * Centralized constants for file upload size limits and allowed MIME types
 */

// File size limits in bytes
export const MAX_PICTURE_UPLOAD_SIZE = 5 * 1024 * 1024; // 5MB
export const MAX_TEACHER_PHOTO_SIZE = 2 * 1024 * 1024; // 2MB
export const MAX_LAB_VERIFICATION_DOCUMENT_SIZE = 10 * 1024 * 1024; // 10MB

// Allowed MIME types for image uploads
export const ALLOWED_IMAGE_MIME_TYPES: readonly string[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/jpg',
];

export const ALLOWED_LAB_VERIFICATION_DOCUMENT_MIME_TYPES: readonly string[] = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/jpg',
];
