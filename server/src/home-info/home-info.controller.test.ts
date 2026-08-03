import { NotFoundException } from "@nestjs/common";
import { Response } from "express";
import { HomeInfoController } from "./home-info.controller";
import { ConfigService } from "../config/config-service";
import {
  HomeInfo,
  HomeInfoPersistenceService,
} from "./home-info.persistence.service";

function makeConfigService(homeId = "palais_freitas"): ConfigService {
  return {
    getConfig: jest
      .fn()
      .mockReturnValue({ home: { homeId, name: "Palais Freitas" } }),
  } as unknown as ConfigService;
}

function makeHomeInfoPersistenceService(
  homeInfo: HomeInfo | null,
): jest.Mocked<HomeInfoPersistenceService> {
  return {
    getLatestByHomeId: jest.fn().mockResolvedValue(homeInfo),
  } as unknown as jest.Mocked<HomeInfoPersistenceService>;
}

function makeResponse(): jest.Mocked<Response> {
  return {
    set: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  } as unknown as jest.Mocked<Response>;
}

describe("HomeInfoController", () => {
  describe("getHomeInfo", () => {
    it("throws NotFoundException when the homeId param does not match the configured home", async () => {
      const configService = makeConfigService("palais_freitas");
      const persistence = makeHomeInfoPersistenceService(null);
      const controller = new HomeInfoController(configService, persistence);
      const response = makeResponse();

      await expect(
        controller.getHomeInfo("some_other_home", response),
      ).rejects.toThrow(NotFoundException);
      expect(persistence.getLatestByHomeId).not.toHaveBeenCalled();
    });

    it("throws NotFoundException when there is no home info entry", async () => {
      const configService = makeConfigService("palais_freitas");
      const persistence = makeHomeInfoPersistenceService(null);
      const controller = new HomeInfoController(configService, persistence);
      const response = makeResponse();

      await expect(
        controller.getHomeInfo("palais_freitas", response),
      ).rejects.toThrow(NotFoundException);
    });

    it("renders the stored markdown as HTML and sends it", async () => {
      const configService = makeConfigService("palais_freitas");
      const persistence = makeHomeInfoPersistenceService({
        id: "uuid-1",
        createdAt: new Date("2024-01-01T00:00:00Z"),
        homeId: "palais_freitas",
        markdown: "# Welcome Home",
      });
      const controller = new HomeInfoController(configService, persistence);
      const response = makeResponse();

      await controller.getHomeInfo("palais_freitas", response);

      expect(response.set).toHaveBeenCalledWith(
        "Content-Type",
        "text/html; charset=utf-8",
      );
      const sentBody = response.send.mock.calls[0][0] as string;
      expect(sentBody).toContain("<h1>Welcome Home</h1>");
      expect(sentBody).toContain("Palais Freitas");
    });
  });
});
