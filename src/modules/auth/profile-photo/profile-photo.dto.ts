import { ApiProperty } from '@nestjs/swagger';

export class ProfilePhotoResponseDto {
  @ApiProperty() width: number;
  @ApiProperty() height: number;
  @ApiProperty() byte_size: number;
  @ApiProperty({ enum: ['image/jpeg'] }) content_type: 'image/jpeg';
  @ApiProperty({ format: 'date-time' }) updated_at: Date;
  @ApiProperty() cleanup_pending: boolean;
}

export class ProfilePhotoDownloadDto {
  @ApiProperty({ format: 'uri' }) url: string;
  @ApiProperty() expires_in_seconds: number;
}

export class ProfilePhotoRemovalDto {
  @ApiProperty({ enum: ['pending', 'completed'] }) cleanup_status:
    'pending' | 'completed';
}
