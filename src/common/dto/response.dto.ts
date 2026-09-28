import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApiMessageResponseDto {
  @ApiProperty({ example: 'Operation completed successfully' })
  message: string;
}

export class ApiSuccessResponseDto {
  @ApiProperty({ type: 'integer', example: 200 })
  status_code: number;

  @ApiProperty({ example: null, nullable: true, type: String })
  message: string | null;

  @ApiProperty({ nullable: true, type: Object })
  data: unknown | null;

  @ApiPropertyOptional({ type: Object })
  meta?: unknown;
}

export class ApiErrorResponseDto {
  @ApiProperty({ type: 'integer', example: 400 })
  status_code: number;

  @ApiProperty({
    oneOf: [
      { type: 'string', example: 'Validation failed' },
      {
        type: 'array',
        items: { type: 'string' },
        example: ['email must be an email'],
      },
    ],
  })
  message: string | string[];

  @ApiProperty({ example: 'Bad Request', nullable: true, type: String })
  error: string | null;

  @ApiProperty({ example: null, nullable: true, type: Object })
  data: null;

  @ApiProperty({ example: '2026-01-15T10:30:00.000Z', format: 'date-time' })
  timestamp: string;

  @ApiProperty({ example: '/api/auth/login' })
  path: string;

  @ApiProperty({ example: 'POST' })
  method: string;

  @ApiPropertyOptional({ description: 'Development environments only' })
  stack?: string;
}
