import { registerDecorator, ValidationOptions } from 'class-validator';

import {
  meetsPasswordPolicy,
  PASSWORD_POLICY_MESSAGE,
} from './password-policy';

/** DTO validation uses exactly the same policy as the hashing boundary. */
export function isSecurePassword(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return (target, propertyKey) => {
    registerDecorator({
      name: 'isSecurePassword',
      target: target.constructor,
      propertyName: String(propertyKey),
      options: validationOptions,
      validator: {
        validate: (value: unknown) => meetsPasswordPolicy(value),
        defaultMessage: () => PASSWORD_POLICY_MESSAGE,
      },
    });
  };
}
