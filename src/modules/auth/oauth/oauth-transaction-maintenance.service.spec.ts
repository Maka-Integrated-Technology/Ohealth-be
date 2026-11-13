import { OAuthTransactionMaintenanceService } from './oauth-transaction-maintenance.service';

describe('OAuthTransactionMaintenanceService', () => {
  const dataSource = { query: jest.fn() };
  const service = new OAuthTransactionMaintenanceService(dataSource as never);

  beforeEach(() => jest.clearAllMocks());

  it('deletes only bounded transactions older than the retention window', async () => {
    dataSource.query.mockResolvedValue([{ id: 'one' }, { id: 'two' }]);
    await expect(service.pruneExpired(20)).resolves.toBe(2);
    expect(dataSource.query).toHaveBeenCalledWith(
      expect.stringContaining("expires_at < now() - interval '24 hours'"),
      [20],
    );
  });

  it.each([0, 501, 1.5])('rejects unsafe batch size %s', async (batchSize) => {
    await expect(service.pruneExpired(batchSize)).rejects.toThrow(
      'between 1 and 500',
    );
  });
});
