import { registerDecorator, ValidationOptions } from 'class-validator';

import { SignupIntent } from '../enums/signup-intent.enum';
import { isOrganizationSignupIntent } from '../signup-intent.policy';

interface ISignupIntentContainer {
  intent?: SignupIntent;
}

/** Keeps public signup intent and organization details mutually consistent. */
export function isSignupOrganizationDetails(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return (target, propertyKey) => {
    registerDecorator({
      name: 'isSignupOrganizationDetails',
      target: target.constructor,
      propertyName: String(propertyKey),
      options: validationOptions,
      validator: {
        validate: (value: unknown, { object }) => {
          const { intent } = object as ISignupIntentContainer;

          return isOrganizationSignupIntent(intent)
            ? value !== undefined && value !== null
            : value === undefined;
        },
        defaultMessage: ({ object }) => {
          const { intent } = object as ISignupIntentContainer;

          return isOrganizationSignupIntent(intent)
            ? 'organization details are required for organization signup intents'
            : 'organization details are not allowed for persona signup intents';
        },
      },
    });
  };
}
