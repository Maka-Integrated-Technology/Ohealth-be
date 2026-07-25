import { Injectable } from '@nestjs/common';

import { VerificationDocumentFileValidator } from '../../common/validators/verification-document-file.validator';

@Injectable()
export class LaboratoryVerificationDocumentFileValidator extends VerificationDocumentFileValidator {}
