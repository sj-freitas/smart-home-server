import { Pool } from "pg";
import { EmailsPersistenceService } from "./emails.persistence.service";

function makePool(queryImpl: jest.Mock): Pool {
  return { query: queryImpl } as unknown as Pool;
}

describe("EmailsPersistenceService.validateEmail", () => {
  it("returns true when any active grant matches, regardless of role", async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [{ id: "1", role: "Guest" }],
    });
    const service = new EmailsPersistenceService(makePool(query));

    await expect(service.validateEmail("user@example.com")).resolves.toBe(true);
  });

  it("returns false when no grant matches", async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const service = new EmailsPersistenceService(makePool(query));

    await expect(service.validateEmail("user@example.com")).resolves.toBe(
      false,
    );
  });
});

describe("EmailsPersistenceService.validateEmailForRoles", () => {
  it("passes the requested roles through to the query", async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [{ id: "1", role: "Admin" }],
    });
    const service = new EmailsPersistenceService(makePool(query));

    await expect(
      service.validateEmailForRoles("admin@example.com", ["User", "Admin"]),
    ).resolves.toBe(true);

    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain("role = ANY($2::text[])");
    expect(params[0]).toBe("admin@example.com");
    expect(params[1]).toEqual(["User", "Admin"]);
  });

  it("returns false when the active grant's role isn't in the required list", async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const service = new EmailsPersistenceService(makePool(query));

    await expect(
      service.validateEmailForRoles("guest@example.com", ["User", "Admin"]),
    ).resolves.toBe(false);
  });
});

describe("EmailsPersistenceService.addEmail", () => {
  it("inserts a role-scoped grant and returns the parsed row", async () => {
    const startDate = new Date("2026-01-01T00:00:00.000Z");
    const endDate = new Date("2026-02-01T00:00:00.000Z");
    const query = jest.fn().mockResolvedValue({
      rows: [
        {
          id: "1",
          created_at: new Date(),
          starts_at: startDate,
          expires_at: endDate,
          email_address: "user@example.com",
          role: "User",
        },
      ],
    });
    const service = new EmailsPersistenceService(makePool(query));

    const result = await service.addEmail(
      "user@example.com",
      "User",
      startDate,
      endDate,
    );

    expect(result.role).toBe("User");
    expect(result.emailAddress).toBe("user@example.com");

    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain("INSERT INTO");
    expect(params).toEqual([startDate, endDate, "user@example.com", "User"]);
  });
});
