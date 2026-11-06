import { BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { RegistrationRetryMaintenanceService } from './registration-retry-maintenance.service';

describe('RegistrationRetryMaintenanceService', () => {
  const query = jest.fn();
  const dataSource = {
    transaction: jest.fn(async (callback) => callback({ query })),
  } as unknown as DataSource;
  const service = new RegistrationRetryMaintenanceService(dataSource);

  beforeEach(() => jest.clearAllMocks());

  it('deletes only bounded retry receipts older than 24 hours', async () => {
    query.mockResolvedValue([{ removed_count: 17 }]);
    await expect(service.pruneExpired(25)).resolves.toBe(17);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("created_at < now() - interval '24 hours'"),
      [25],
    );
    expect(query.mock.calls[0][0]).toContain('FOR UPDATE SKIP LOCKED');
    expect(query.mock.calls[0][0]).toContain(
      'DELETE FROM registration_attempts',
    );
  });

  it.each([0, 501, 1.5])('rejects unsafe batch size %s', async (batchSize) => {
    await expect(service.pruneExpired(batchSize)).rejects.toThrow(
      BadRequestException,
    );
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });
});
