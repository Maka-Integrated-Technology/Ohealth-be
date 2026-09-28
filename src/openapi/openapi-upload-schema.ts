import type { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';

interface IFileUploadSchemaOptions {
  allowedMimeTypes: readonly string[];
  maxSizeBytes: number;
}

export function createFileUploadSchema({
  allowedMimeTypes,
  maxSizeBytes,
}: IFileUploadSchemaOptions): SchemaObject {
  return {
    type: 'object',
    required: ['file'],
    properties: {
      file: {
        type: 'string',
        format: 'binary',
        maxLength: maxSizeBytes,
        description: `Maximum size: ${maxSizeBytes} bytes. Accepted MIME types: ${allowedMimeTypes.join(', ')}.`,
      },
    },
  };
}
