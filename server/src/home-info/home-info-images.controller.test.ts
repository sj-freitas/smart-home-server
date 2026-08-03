import { NotFoundException } from "@nestjs/common";
import { Response } from "express";
import { HomeInfoImagesController } from "./home-info-images.controller";
import { ConfigService } from "../config/config-service";
import {
  HomeInfoImage,
  HomeInfoImagesPersistenceService,
} from "./home-info-images.persistence.service";

function makeConfigService(homeId = "palais_freitas"): ConfigService {
  return {
    getConfig: jest.fn().mockReturnValue({ home: { homeId } }),
  } as unknown as ConfigService;
}

function makeHomeInfoImagesPersistenceService(
  image: HomeInfoImage | null,
): jest.Mocked<HomeInfoImagesPersistenceService> {
  return {
    getByHomeIdAndName: jest.fn().mockResolvedValue(image),
  } as unknown as jest.Mocked<HomeInfoImagesPersistenceService>;
}

function makeResponse(): jest.Mocked<Response> {
  return {
    set: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  } as unknown as jest.Mocked<Response>;
}

describe("HomeInfoImagesController", () => {
  describe("getImage", () => {
    it("throws NotFoundException when the homeId param does not match the configured home", async () => {
      const configService = makeConfigService("palais_freitas");
      const persistence = makeHomeInfoImagesPersistenceService(null);
      const controller = new HomeInfoImagesController(
        configService,
        persistence,
      );
      const response = makeResponse();

      await expect(
        controller.getImage("some_other_home", "cover.jpg", response),
      ).rejects.toThrow(NotFoundException);
      expect(persistence.getByHomeIdAndName).not.toHaveBeenCalled();
    });

    it("throws NotFoundException when the image does not exist", async () => {
      const configService = makeConfigService("palais_freitas");
      const persistence = makeHomeInfoImagesPersistenceService(null);
      const controller = new HomeInfoImagesController(
        configService,
        persistence,
      );
      const response = makeResponse();

      await expect(
        controller.getImage("palais_freitas", "missing.jpg", response),
      ).rejects.toThrow(NotFoundException);
    });

    it("decodes the base64 image and sends it as a jpeg", async () => {
      const configService = makeConfigService("palais_freitas");
      const imageBuffer = Buffer.from("fake-image-data");
      const persistence = makeHomeInfoImagesPersistenceService({
        id: "uuid-1",
        createdAt: new Date("2024-01-01T00:00:00Z"),
        homeId: "palais_freitas",
        name: "cover.jpg",
        imageBase64: imageBuffer.toString("base64"),
      });
      const controller = new HomeInfoImagesController(
        configService,
        persistence,
      );
      const response = makeResponse();

      await controller.getImage("palais_freitas", "cover.jpg", response);

      expect(response.set).toHaveBeenCalledWith("Content-Type", "image/jpeg");
      const sentBuffer = response.send.mock.calls[0][0] as Buffer;
      expect(Buffer.compare(sentBuffer, imageBuffer)).toBe(0);
      expect(persistence.getByHomeIdAndName).toHaveBeenCalledWith(
        "palais_freitas",
        "cover.jpg",
      );
    });
  });
});
