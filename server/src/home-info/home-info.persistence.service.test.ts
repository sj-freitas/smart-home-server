import { Pool } from "pg";
import { HomeInfoPersistenceService } from "./home-info.persistence.service";

function makePool(rows: unknown[] = []): jest.Mocked<Pool> {
  return {
    query: jest.fn().mockResolvedValue({ rows }),
  } as unknown as jest.Mocked<Pool>;
}

describe("HomeInfoPersistenceService", () => {
  describe("getLatestByHomeId", () => {
    it("returns null when no rows are found", async () => {
      const pool = makePool([]);
      const svc = new HomeInfoPersistenceService(pool);

      const result = await svc.getLatestByHomeId("palais_freitas");

      expect(result).toBeNull();
    });

    it("returns the mapped home info row", async () => {
      const createdAt = new Date("2024-01-01T12:00:00Z");
      const pool = makePool([
        {
          id: "uuid-1",
          created_at: createdAt,
          home_id: "palais_freitas",
          markdown: "# Welcome",
        },
      ]);
      const svc = new HomeInfoPersistenceService(pool);

      const result = await svc.getLatestByHomeId("palais_freitas");

      expect(result).toEqual({
        id: "uuid-1",
        createdAt,
        homeId: "palais_freitas",
        markdown: "# Welcome",
      });
    });

    it("queries filtering by home_id and orders by created_at desc limit 1", async () => {
      const pool = makePool([]);
      const svc = new HomeInfoPersistenceService(pool);

      await svc.getLatestByHomeId("palais_freitas");

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining("WHERE home_id = $1"),
        ["palais_freitas"],
      );
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining("ORDER BY created_at DESC"),
        ["palais_freitas"],
      );
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining("LIMIT 1"),
        ["palais_freitas"],
      );
    });
  });
});
