import { AuthAccessLevel, AuthRoutingTarget } from '../enums/auth-routing.enum';

export interface IAuthRoutingResult {
  routing_target: AuthRoutingTarget;
  access_level: AuthAccessLevel;
  verification_status: string | null;
}
