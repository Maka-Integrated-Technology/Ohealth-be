import { UserRole } from '../../user/enums/user-role.enum';

export const haveSameRoles = (
  tokenRole: UserRole[] | UserRole | undefined,
  databaseRoles: UserRole[] | undefined,
): boolean => {
  const tokenRoles = Array.isArray(tokenRole)
    ? tokenRole
    : tokenRole
      ? [tokenRole]
      : [];
  const currentRoles = databaseRoles ?? [];
  if (!tokenRoles.length || !currentRoles.length) return false;

  const validRoles = new Set(Object.values(UserRole));
  if (tokenRoles.some((role) => !validRoles.has(role))) return false;

  const tokenRoleSet = new Set(tokenRoles);
  const currentRoleSet = new Set(currentRoles);
  return (
    tokenRoleSet.size === currentRoleSet.size &&
    [...tokenRoleSet].every((role) => currentRoleSet.has(role))
  );
};
