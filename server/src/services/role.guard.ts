import {
  CanActivate,
  ForbiddenException,
  Injectable,
  Type,
  UnauthorizedException,
} from "@nestjs/common";
import { AuthorizationService } from "./auth/authorization.service";
import { Role } from "./auth/emails.persistence.service";

/**
 * Builds a guard that only authorizes requests whose email holds one of the
 * given roles (or bypasses via IP allowlist / API key, same as AuthGuard).
 */
export function RoleGuard(roles: Role[]): Type<CanActivate> {
  @Injectable()
  class RoleGuardMixin implements CanActivate {
    constructor(private readonly authorizationService: AuthorizationService) {}

    async canActivate(): Promise<boolean> {
      const result = await this.authorizationService.isUserAuthorized(roles);

      if (result === "Authorized") {
        return true;
      }

      if (result === "NeedsLogIn") {
        throw new UnauthorizedException("Unauthorized");
      }

      throw new ForbiddenException("Forbidden");
    }
  }

  return RoleGuardMixin;
}
