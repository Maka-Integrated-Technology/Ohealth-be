import { BadRequestException } from '@nestjs/common';

import { IMulterFile } from '../../../common/types';
import {
  ALLOWED_ORGANIZATION_DOCUMENT_MIME_TYPES,
  MAX_ORGANIZATION_DOCUMENT_SIZE,
} from '../../../constants/file-upload.constants';

export const ORGANIZATION_DOCUMENT_UPLOAD_OPTIONS = {
  limits: { fileSize: MAX_ORGANIZATION_DOCUMENT_SIZE },
  fileFilter: (
    _request: unknown,
    file: IMulterFile,
    callback: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    if (!ALLOWED_ORGANIZATION_DOCUMENT_MIME_TYPES.includes(file.mimetype)) {
      callback(
        new BadRequestException('unsupported verification document type'),
        false,
      );
      return;
    }
    callback(null, true);
  },
};
