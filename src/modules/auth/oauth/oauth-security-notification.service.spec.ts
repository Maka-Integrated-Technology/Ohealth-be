import { EmailTemplateID } from '../../../constants/email-constants';

import { OAuthSecurityNotificationService } from './oauth-security-notification.service';

describe('OAuthSecurityNotificationService', () => {
  it('sends a token-free security notice to the verified canonical contact', async () => {
    const event = {
      aggregate_id: 'user-id',
      status: 'pending',
      attempts: 0,
      payload: { user_id: 'user-id' },
    };
    const query = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      setOnLocked: jest.fn().mockReturnThis(),
      getOne: jest
        .fn()
        .mockResolvedValueOnce(event)
        .mockResolvedValueOnce(null),
    };
    const manager = {
      createQueryBuilder: jest.fn().mockReturnValue(query),
      findOne: jest.fn().mockResolvedValue({
        id: 'user-id',
        email: 'owner@example.com',
        email_verified_at: new Date(),
      }),
      save: jest.fn(),
    };
    const dataSource = {
      transaction: jest.fn(async (work: (value: typeof manager) => unknown) =>
        work(manager),
      ),
    };
    const email = { sendMail: jest.fn().mockResolvedValue(undefined) };
    const service = new OAuthSecurityNotificationService(
      dataSource as never,
      email as never,
    );

    await expect(service.dispatchBatch(2)).resolves.toBe(1);
    expect(email.sendMail).toHaveBeenCalledWith({
      to: [{ email: 'owner@example.com' }],
      subject: 'Your OHealth sign-in method changed',
      templateNameID: EmailTemplateID.SECURITY_AUTHENTICATOR_CHANGED,
      templateData: {},
    });
    expect(JSON.stringify(email.sendMail.mock.calls)).not.toMatch(
      /google-token|nonce|id_token/i,
    );
    expect(event.status).toBe('published');
  });
});
