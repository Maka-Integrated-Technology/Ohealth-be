import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { AuthCapability } from '../context/auth-capability';

import { CapabilitiesGuard } from './capabilities.guard';

describe('CapabilitiesGuard', () => {
  const reflector = { getAllAndOverride: jest.fn() };
  const contexts = { assertCapabilities: jest.fn() };

  const executionContext = (request: Record<string, unknown>) =>
    ({
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({ getRequest: () => request }),
    }) as unknown as ExecutionContext;

  beforeEach(() => jest.clearAllMocks());

  it('allows routes without capability metadata', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const guard = new CapabilitiesGuard(reflector as never, contexts as never);

    await expect(guard.canActivate(executionContext({}))).resolves.toBe(true);
    expect(contexts.assertCapabilities).not.toHaveBeenCalled();
  });

  it.each([
    undefined,
    {},
    { id: 'user-id' },
    { id: '', sessionId: 'session-id' },
  ])('denies incomplete authenticated identities', async (user) => {
    reflector.getAllAndOverride.mockReturnValue([
      AuthCapability.PATIENT_BOOKINGS,
    ]);
    const guard = new CapabilitiesGuard(reflector as never, contexts as never);

    await expect(
      guard.canActivate(executionContext({ user, headers: {} })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('fails closed when the context service is unavailable', async () => {
    reflector.getAllAndOverride.mockReturnValue([
      AuthCapability.PATIENT_BOOKINGS,
    ]);
    const guard = new CapabilitiesGuard(reflector as unknown as Reflector);

    await expect(
      guard.canActivate(
        executionContext({
          user: { id: 'user-id', sessionId: 'session-id' },
          headers: {},
        }),
      ),
    ).rejects.toThrow('authorization context is unavailable');
  });

  it('requires and forwards the explicit active organization', async () => {
    reflector.getAllAndOverride.mockReturnValue([
      AuthCapability.ORGANIZATION_ONBOARDING,
    ]);
    const resolved = { active_organization_id: 'organization-a' };
    contexts.assertCapabilities.mockResolvedValue(resolved);
    const guard = new CapabilitiesGuard(reflector as never, contexts as never);
    const request = {
      user: { id: 'user-id', sessionId: 'session-id' },
      headers: { ['x-organization-id']: 'organization-a' },
    };

    await expect(guard.canActivate(executionContext(request))).resolves.toBe(
      true,
    );
    expect(contexts.assertCapabilities).toHaveBeenCalledWith(
      'user-id',
      'session-id',
      [AuthCapability.ORGANIZATION_ONBOARDING],
      'organization-a',
    );
    expect(request).toHaveProperty('authContext', resolved);
  });

  it('denies organization routes without an active organization selector', async () => {
    reflector.getAllAndOverride.mockReturnValue([
      AuthCapability.ORGANIZATION_OPERATIONAL,
    ]);
    const guard = new CapabilitiesGuard(reflector as never, contexts as never);

    await expect(
      guard.canActivate(
        executionContext({
          user: { id: 'user-id', sessionId: 'session-id' },
          headers: {},
        }),
      ),
    ).rejects.toThrow('active organization is required');
    expect(contexts.assertCapabilities).not.toHaveBeenCalled();
  });

  it('propagates capability denials without attaching context', async () => {
    reflector.getAllAndOverride.mockReturnValue([
      AuthCapability.PROFESSIONAL_OPERATIONAL,
    ]);
    contexts.assertCapabilities.mockRejectedValue(new ForbiddenException());
    const guard = new CapabilitiesGuard(reflector as never, contexts as never);
    const request = {
      user: { id: 'patient-id', sessionId: 'session-id' },
      headers: {},
    };

    await expect(
      guard.canActivate(executionContext(request)),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(request).not.toHaveProperty('authContext');
  });
});
