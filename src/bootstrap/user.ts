import { UserService } from '../user/service/user-service.js';

export interface UserPlatform {
  readonly service: UserService;
}

/** USR — Composition root. User Module builds on top of Auth Identity. */
export function buildUserPlatform(): UserPlatform {
  return { service: new UserService() };
}
