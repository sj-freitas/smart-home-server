import { Pool } from "pg";
import { StatePersistenceService } from "./state.persistence.service";

function makePool(rows: unknown[] = []): jest.Mocked<Pool> {
  return {
    query: jest.fn().mockResolvedValue({ rows }),
  } as unknown as jest.Mocked<Pool>;
}

describe("StatePersistenceService", () => {
  describe("getHomeState", () => {
    it("returns null when no matching home is found", async () => {
      const pool = makePool([]);
      const svc = new StatePersistenceService(pool);

      const result = await svc.getHomeState("My Home");

      expect(result).toBeNull();
    });

    it("defaults bannerUrl to an empty string for state stored before that field existed", async () => {
      const pool = makePool([
        {
          id: "uuid-1",
          name: "My Home",
          state: {
            name: "My Home",
            pageTitle: "",
            logo: "",
            faviconUrl: "",
            subTitle: "",
            rooms: [],
            // bannerUrl intentionally omitted, matching legacy rows.
          },
        },
      ]);
      const svc = new StatePersistenceService(pool);

      const result = await svc.getHomeState("My Home");

      expect(result?.bannerUrl).toBe("");
    });

    it("preserves bannerUrl when present", async () => {
      const pool = makePool([
        {
          id: "uuid-1",
          name: "My Home",
          state: {
            name: "My Home",
            pageTitle: "",
            logo: "",
            faviconUrl: "",
            bannerUrl: "https://example.com/banner.jpg",
            subTitle: "",
            rooms: [],
          },
        },
      ]);
      const svc = new StatePersistenceService(pool);

      const result = await svc.getHomeState("My Home");

      expect(result?.bannerUrl).toBe("https://example.com/banner.jpg");
    });
  });
});
