import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { UserRole } from '../../user/enums/user-role.enum';

import { RolesGuard } from './roles.guard';

describe('RolesGuard security evidence', () => {
  const reflector = { getAllAndOverride: jest.fn() };
  const contexts = { resolve: jest.fn() };
  const audit = { recordAttempt: jest.fn().mockResolvedValue(undefined) };
  const context = {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({
      getRequest: () => ({
        user: {
          id: '550e8400-e29b-41d4-a716-446655440000',
          sessionId: '550e8400-e29b-41d4-a716-446655440001',
        },
      }),
    }),
  } as unknown as ExecutionContext;

  beforeEach(() => {
    jest.clearAllMocks();
    reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);
  });

  it('records a denied role decision and preserves the refusal', async () => {
    contexts.resolve.mockResolvedValue({ capabilities: [] });
    const guard = new RolesGuard(
      reflector as unknown as Reflector,
      contexts as never,
      audit as never,
    );

    await expect(guard.canActivate(context)).resolves.toBe(false);
    expect(audit.recordAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: 'authorization_denial',
        outcome: 'denied',
      }),
    );
  });

  it('fails closed when denial evidence cannot be written', async () => {
    contexts.resolve.mockResolvedValue({ capabilities: [] });
    audit.recordAttempt.mockRejectedValueOnce(new Error('audit unavailable'));
    const guard = new RolesGuard(
      reflector as unknown as Reflector,
      contexts as never,
      audit as never,
    );

    await expect(guard.canActivate(context)).rejects.toThrow(
      'audit unavailable',
    );
  });
});
