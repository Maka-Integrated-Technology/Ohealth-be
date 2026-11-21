import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiAcceptedResponse,
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiConsumes,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiPayloadTooLargeResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { IMulterFile } from '../../../common/types';
import { createFileUploadSchema } from '../../../openapi/openapi-upload-schema';
import { CurrentUser } from '../decorators/current-user.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

import {
  MAX_PROFILE_PHOTO_INPUT_BYTES,
  PROFILE_PHOTO_MIME_TYPES,
} from './profile-photo-image';
import {
  ProfilePhotoDownloadDto,
  ProfilePhotoRemovalDto,
  ProfilePhotoResponseDto,
} from './profile-photo.dto';
import { ProfilePhotoService } from './profile-photo.service';

const uploadOptions = {
  limits: { fileSize: MAX_PROFILE_PHOTO_INPUT_BYTES, files: 1, fields: 0 },
  fileFilter: (
    _request: unknown,
    file: IMulterFile,
    callback: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    if (!PROFILE_PHOTO_MIME_TYPES.includes(file.mimetype as never)) {
      callback(
        new BadRequestException('Unsupported profile photo type.'),
        false,
      );
      return;
    }
    callback(null, true);
  },
};

@ApiTags('Authentication')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('auth/me/profile-photo')
export class ProfilePhotoController {
  constructor(private readonly photos: ProfilePhotoService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file', uploadOptions))
  @ApiOperation({
    summary:
      'Upload or replace the authenticated person’s private profile photo',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: createFileUploadSchema({
      allowedMimeTypes: PROFILE_PHOTO_MIME_TYPES,
      maxSizeBytes: MAX_PROFILE_PHOTO_INPUT_BYTES,
    }),
  })
  @ApiOkResponse({ type: ProfilePhotoResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid or malformed image' })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse({
    description: 'An active patient or professional persona is required',
  })
  @ApiConflictResponse({ description: 'Upload reservation expired' })
  @ApiPayloadTooLargeResponse()
  @ApiInternalServerErrorResponse()
  upload(
    @CurrentUser() user: { id: string; sessionId: string },
    @UploadedFile() file: IMulterFile,
  ): Promise<ProfilePhotoResponseDto> {
    return this.photos.upload(user.id, user.sessionId, file);
  }

  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Get a short-lived, owner-authorized profile photo URL',
  })
  @ApiOkResponse({ type: ProfilePhotoDownloadDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse({ description: 'No canonical profile photo exists' })
  @ApiInternalServerErrorResponse()
  get(
    @CurrentUser() user: { id: string; sessionId: string },
  ): Promise<ProfilePhotoDownloadDto> {
    return this.photos.signedGet(user.id, user.sessionId);
  }

  @Delete()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Remove the active profile photo and enqueue versioned cleanup',
  })
  @ApiAcceptedResponse({ type: ProfilePhotoRemovalDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiInternalServerErrorResponse()
  remove(
    @CurrentUser() user: { id: string; sessionId: string },
  ): Promise<ProfilePhotoRemovalDto> {
    return this.photos.remove(user.id, user.sessionId);
  }
}
