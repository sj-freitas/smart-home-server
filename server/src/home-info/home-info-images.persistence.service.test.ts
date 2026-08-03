import { Pool } from "pg";
import { HomeInfoImagesPersistenceService } from "./home-info-images.persistence.service";

function makePool(rows: unknown[] = []): jest.Mocked<Pool> {
  return {
    query: jest.fn().mockResolvedValue({ rows }),
  } as unknown as jest.Mocked<Pool>;
}

describe("HomeInfoImagesPersistenceService", () => {
  describe("getByHomeIdAndName", () => {
    it("returns null when no rows are found", async () => {
      const pool = makePool([]);
      const svc = new HomeInfoImagesPersistenceService(pool);

      const result = await svc.getByHomeIdAndName(
        "palais_freitas",
        "cover.jpg",
      );

      expect(result).toBeNull();
    });

    it("returns the mapped image row", async () => {
      const createdAt = new Date("2024-01-01T12:00:00Z");
      const pool = makePool([
        {
          id: "uuid-1",
          created_at: createdAt,
          home_id: "palais_freitas",
          name: "cover.jpg",
          image_base64: "ZmFrZS1pbWFnZS1kYXRh",
        },
      ]);
      const svc = new HomeInfoImagesPersistenceService(pool);

      const result = await svc.getByHomeIdAndName(
        "palais_freitas",
        "cover.jpg",
      );

      expect(result).toEqual({
        id: "uuid-1",
        createdAt,
        homeId: "palais_freitas",
        name: "cover.jpg",
        imageBase64: "ZmFrZS1pbWFnZS1kYXRh",
      });
    });

    it("queries filtering by home_id and name", async () => {
      const pool = makePool([]);
      const svc = new HomeInfoImagesPersistenceService(pool);

      await svc.getByHomeIdAndName("palais_freitas", "cover.jpg");

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining("WHERE home_id = $1 AND name = $2"),
        ["palais_freitas", "cover.jpg"],
      );
    });
  });
});
