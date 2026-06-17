import { HomeConfig } from "../config/home.zod";
import { RequestContext } from "./request-context";

// Allowed CIDR ranges (useful for local networks)
const ALLOWED_CIDRS = [
  "192.168.1.0/24", // example: whole 192.168.1.x subnet
  "10.0.0.0/8", // example: whole 10.x.x.x private range
];

function ipv4ToInt(ip: string): number {
  const parts = ip.split(".");
  if (parts.length !== 4) throw new Error("Not an IPv4 address");
  return parts.reduce((acc, p) => (acc << 8) + parseInt(p, 10), 0) >>> 0;
}

/** Check if an IPv4 address is inside a CIDR */
function cidrContains(cidr: string, ip: string): boolean {
  const [net, prefixStr] = cidr.split("/");
  const prefix = Number(prefixStr);
  if (!net || isNaN(prefix)) return false;

  try {
    const netInt = ipv4ToInt(net);
    const ipInt = ipv4ToInt(ip);
    const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
    return (netInt & mask) === (ipInt & mask);
  } catch (e) {
    // not IPv4 -> false
    return false;
  }
}

function isAllowedIp(ip: string | null, allowedIps: string[]): boolean {
  if (!ip) return false;

  // direct match
  if (allowedIps.includes(ip)) return true;

  // check each CIDR range
  for (const cidr of ALLOWED_CIDRS) {
    if (cidrContains(cidr, ip)) return true;
  }

  return false;
}

export class IpValidationService {
  constructor(
    private readonly request: RequestContext,
    private readonly config: HomeConfig,
  ) {}

  /**
   * Validates if a user is able to access the API based only on their IP.
   * If not, returns false.
   *
   * @returns {Boolean} whether a user is able to access the API based only on their IP.
   */
  public isRequestAllowedBasedOnIP(): boolean {
    const AUTH_ALWAYS_DISALLOW_THE_IP =
      process.env.AUTH_ALWAYS_DISALLOW_THE_IP === "true";
    if (AUTH_ALWAYS_DISALLOW_THE_IP) {
      // True means that all requests must be validated regardless of IP. In
      // production we don't want this behavior. We want to have the IP validation,
      // locally we only want to set to true when testing the Auth flow.
      return false;
    }

    // IP is in config it means that users need to be authenticated if they are in a different network.
    // IP doesn't exist it means that everyone is allowed.
    if (!this.config.ip) {
      return true;
    }

    const isLocalIp = isAllowedIp(this.request.clientIp, [
      this.config.ip,
      "127.0.0.1",
    ]);

    return isLocalIp;
  }
}
