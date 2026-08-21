import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from "@nestjs/common";
import { RoleGuard } from "./role.guard";
import { AuthorizationService } from "./auth/authorization.service";

const context = {} as ExecutionContext;

function makeGuard(result: "Authorized" | "NeedsLogIn" | "Forbidden") {
  const authorizationService = {
    isUserAuthorized: jest.fn().mockResolvedValue(result),
  } as unknown as AuthorizationService;

  const GuardClass = RoleGuard(["User", "Admin"]);
  return {
    guard: new GuardClass(authorizationService),
    authorizationService,
  };
}

describe("RoleGuard", () => {
  it("allows the request when authorized for the required roles", async () => {
    const { guard, authorizationService } = makeGuard("Authorized");

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(authorizationService.isUserAuthorized).toHaveBeenCalledWith([
      "User",
      "Admin",
    ]);
  });

  it("throws UnauthorizedException when a login is needed", async () => {
    const { guard } = makeGuard("NeedsLogIn");

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it("throws ForbiddenException when the required roles aren't held", async () => {
    const { guard } = makeGuard("Forbidden");

    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
  });
});
