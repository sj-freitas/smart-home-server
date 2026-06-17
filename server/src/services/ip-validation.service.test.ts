import { IpValidationService } from "./ip-validation.service";
import { RequestContext } from "./request-context";
import { HomeConfig } from "../config/home.zod";

const baseConfig: HomeConfig = { name: "Test Home", rooms: [] };

const makeConfig = (ip?: string): HomeConfig => ({ ...baseConfig, ip });

const makeContext = (
  clientIp: string | null,
): Pick<RequestContext, "clientIp"> => ({ clientIp }) as any;

describe("IpValidationService", () => {
  afterEach(() => {
    delete process.env.AUTH_ALWAYS_DISALLOW_THE_IP;
  });

  it('always returns false when AUTH_ALWAYS_DISALLOW_THE_IP is "true"', () => {
    process.env.AUTH_ALWAYS_DISALLOW_THE_IP = "true";
    const svc = new IpValidationService(
      makeContext("192.168.1.5") as RequestContext,
      makeConfig(),
    );
    expect(svc.isRequestAllowedBasedOnIP()).toBe(false);
  });

  describe("when no IP is configured in home config", () => {
    it("allows every request", () => {
      const svc = new IpValidationService(
        makeContext("8.8.8.8") as RequestContext,
        makeConfig(),
      );
      expect(svc.isRequestAllowedBasedOnIP()).toBe(true);
    });
  });

  describe("when an IP is configured", () => {
    it("allows the exact configured IP", () => {
      const svc = new IpValidationService(
        makeContext("203.0.113.5") as RequestContext,
        makeConfig("203.0.113.5"),
      );
      expect(svc.isRequestAllowedBasedOnIP()).toBe(true);
    });

    it("always allows localhost (127.0.0.1)", () => {
      const svc = new IpValidationService(
        makeContext("127.0.0.1") as RequestContext,
        makeConfig("203.0.113.5"),
      );
      expect(svc.isRequestAllowedBasedOnIP()).toBe(true);
    });

    it("allows IPs in the 192.168.1.0/24 LAN range", () => {
      const svc = new IpValidationService(
        makeContext("192.168.1.200") as RequestContext,
        makeConfig("203.0.113.5"),
      );
      expect(svc.isRequestAllowedBasedOnIP()).toBe(true);
    });

    it("allows IPs in the 10.0.0.0/8 private range", () => {
      const svc = new IpValidationService(
        makeContext("10.20.30.40") as RequestContext,
        makeConfig("203.0.113.5"),
      );
      expect(svc.isRequestAllowedBasedOnIP()).toBe(true);
    });

    it("rejects public IPs not in any allowed range", () => {
      const svc = new IpValidationService(
        makeContext("8.8.8.8") as RequestContext,
        makeConfig("203.0.113.5"),
      );
      expect(svc.isRequestAllowedBasedOnIP()).toBe(false);
    });

    it("returns false when the client IP is null", () => {
      const svc = new IpValidationService(
        makeContext(null) as RequestContext,
        makeConfig("203.0.113.5"),
      );
      expect(svc.isRequestAllowedBasedOnIP()).toBe(false);
    });
  });
});
