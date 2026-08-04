import { NotFoundException } from "@nestjs/common";
import { HomeInfoController } from "./home-info.controller";
import { ConfigService } from "../config/config-service";
import {
  HomeInfo,
  HomeInfoPersistenceService,
} from "./home-info.persistence.service";

function makeConfigService(
  homeId = "palais-freitas",
  overrides: Record<string, unknown> = {},
): ConfigService {
  return {
    getConfig: jest.fn().mockReturnValue({ home: { homeId, ...overrides } }),
  } as unknown as ConfigService;
}

function makeHomeInfoPersistenceService(
  homeInfo: HomeInfo | null,
): jest.Mocked<HomeInfoPersistenceService> {
  return {
    getLatestByHomeId: jest.fn().mockResolvedValue(homeInfo),
  } as unknown as jest.Mocked<HomeInfoPersistenceService>;
}

describe("HomeInfoController", () => {
  describe("getHomeInfo", () => {
    it("throws NotFoundException when the homeId param does not match the configured home", async () => {
      const configService = makeConfigService("palais-freitas");
      const persistence = makeHomeInfoPersistenceService(null);
      const controller = new HomeInfoController(configService, persistence);

      await expect(controller.getHomeInfo("some_other_home")).rejects.toThrow(
        NotFoundException,
      );
      expect(persistence.getLatestByHomeId).not.toHaveBeenCalled();
    });

    it("throws NotFoundException when there is no home info entry", async () => {
      const configService = makeConfigService("palais-freitas");
      const persistence = makeHomeInfoPersistenceService(null);
      const controller = new HomeInfoController(configService, persistence);

      await expect(controller.getHomeInfo("palais-freitas")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("returns the raw markdown and its last updated timestamp", async () => {
      const createdAt = new Date("2024-01-01T00:00:00Z");
      const configService = makeConfigService("palais-freitas");
      const persistence = makeHomeInfoPersistenceService({
        id: "uuid-1",
        createdAt,
        homeId: "palais-freitas",
        markdown: "# Welcome Home",
      });
      const controller = new HomeInfoController(configService, persistence);

      const result = await controller.getHomeInfo("palais-freitas");

      expect(result).toEqual({
        markdown: "# Welcome Home",
        updatedAt: createdAt,
        bannerUrl: null,
      });
    });

    it("includes the configured bannerUrl when present", async () => {
      const configService = makeConfigService("palais-freitas", {
        bannerUrl: "https://example.com/banner.jpg",
      });
      const persistence = makeHomeInfoPersistenceService({
        id: "uuid-1",
        createdAt: new Date("2024-01-01T00:00:00Z"),
        homeId: "palais-freitas",
        markdown: "# Welcome Home",
      });
      const controller = new HomeInfoController(configService, persistence);

      const result = await controller.getHomeInfo("palais-freitas");

      expect(result.bannerUrl).toBe("https://example.com/banner.jpg");
    });
  });
});
