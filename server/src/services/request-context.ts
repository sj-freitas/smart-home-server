import type { Request } from "express";

function getClientIp(req: Request): string | null {
  // X-Forwarded-For may contain a comma separated list - client is first
  const xff = (req.headers["x-forwarded-for"] as string) || "";
  const candidate =
    xff
      .split(",")
      .map((s) => s.trim())
      .find(Boolean) ||
    req.socket?.remoteAddress ||
    req.ip; // express populated value as fallback

  if (!candidate) return null;

  // If IPv6 mapped IPv4 like ::ffff:192.168.1.10 -> strip prefix
  if (candidate.startsWith("::ffff:")) return candidate.replace("::ffff:", "");
  // If raw IPv6 we won't try to convert here (CIDR checks below are IPv4-only),
  // but return the string anyway
  return candidate;
}

export class RequestContext {
  public static readonly SESSION_COOKIE_NAME = "session";

  constructor(private readonly req: Request) {}

  get requestId(): string | undefined {
    return this.req.headers["x-request-id"] as string | undefined;
  }

  get clientIp(): string | null {
    return getClientIp(this.req);
  }

  get authorizationHeader(): string | undefined {
    return this.req.headers["authorization"] as string | undefined;
  }

  get sessionCookie(): string | undefined {
    return this.req.cookies?.[RequestContext.SESSION_COOKIE_NAME];
  }
}
