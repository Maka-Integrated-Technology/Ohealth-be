import { User } from '../entities/user.entity';

export type AuthenticatedUserProfileUpdate = Partial<
  Pick<
    User,
    | 'first_name'
    | 'last_name'
    | 'middle_name'
    | 'gender'
    | 'dob'
    | 'phone'
    | 'country'
    | 'image'
  >
>;

export interface IGoogleIdentityProfile {
  firstName: string;
  lastName: string;
}
