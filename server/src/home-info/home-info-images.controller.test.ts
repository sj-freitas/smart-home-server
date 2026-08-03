import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Response } from "express";
import { HomeInfoImagesController } from "./home-info-images.controller";
import { ConfigService } from "../config/config-service";
import {
  HomeInfoImage,
  HomeInfoImagesPersistenceService,
} from "./home-info-images.persistence.service";

const resizedBuffer = Buffer.from("resized-image-data");
const mockToBuffer = jest.fn().mockResolvedValue(resizedBuffer);
const mockJpeg = jest.fn().mockReturnValue({ toBuffer: mockToBuffer });
const mockResize = jest.fn().mockReturnValue({ jpeg: mockJpeg });
const mockSharp = jest.fn().mockReturnValue({ resize: mockResize });

jest.mock("sharp", () => (input: unknown) => mockSharp(input));

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
  beforeEach(() => {
    jest.clearAllMocks();
    mockToBuffer.mockResolvedValue(resizedBuffer);
    mockJpeg.mockReturnValue({ toBuffer: mockToBuffer });
    mockResize.mockReturnValue({ jpeg: mockJpeg });
    mockSharp.mockReturnValue({ resize: mockResize });
  });

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
        controller.getImage("some_other_home", "cover.jpg", {}, response),
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
        controller.getImage("palais_freitas", "missing.jpg", {}, response),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws BadRequestException when width/height query params are invalid", async () => {
      const configService = makeConfigService("palais_freitas");
      const persistence = makeHomeInfoImagesPersistenceService(null);
      const controller = new HomeInfoImagesController(
        configService,
        persistence,
      );
      const response = makeResponse();

      await expect(
        controller.getImage(
          "palais_freitas",
          "cover.jpg",
          { width: "not-a-number" },
          response,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("throws BadRequestException when width exceeds the max allowed dimension", async () => {
      const configService = makeConfigService("palais_freitas");
      const persistence = makeHomeInfoImagesPersistenceService(null);
      const controller = new HomeInfoImagesController(
        configService,
        persistence,
      );
      const response = makeResponse();

      await expect(
        controller.getImage(
          "palais_freitas",
          "cover.jpg",
          { width: "999999" },
          response,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("decodes the base64 image and sends it unmodified as a jpeg when no size is requested", async () => {
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

      await controller.getImage("palais_freitas", "cover.jpg", {}, response);

      expect(mockSharp).not.toHaveBeenCalled();
      expect(response.set).toHaveBeenCalledWith("Content-Type", "image/jpeg");
      const sentBuffer = response.send.mock.calls[0][0] as Buffer;
      expect(Buffer.compare(sentBuffer, imageBuffer)).toBe(0);
      expect(persistence.getByHomeIdAndName).toHaveBeenCalledWith(
        "palais_freitas",
        "cover.jpg",
      );
    });

    it("resizes the image via sharp when width and/or height are provided", async () => {
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

      await controller.getImage(
        "palais_freitas",
        "cover.jpg",
        { width: "400", height: "300" },
        response,
      );

      expect(mockSharp).toHaveBeenCalledWith(imageBuffer);
      expect(mockResize).toHaveBeenCalledWith(400, 300, { fit: "inside" });
      expect(mockJpeg).toHaveBeenCalled();
      const sentBuffer = response.send.mock.calls[0][0] as Buffer;
      expect(Buffer.compare(sentBuffer, resizedBuffer)).toBe(0);
    });
  });
});
