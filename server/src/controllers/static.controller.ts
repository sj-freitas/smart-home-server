import {
  Controller,
  Get,
  Param,
  Res,
  NotFoundException,
  Req,
  BadRequestException,
} from "@nestjs/common";
import { Response, Request } from "express";
import { join, normalize, sep } from "path";
import { existsSync, statSync } from "fs";

@Controller()
export class StaticController {
  private readonly clientDistPath = join(process.cwd(), "public");
  private readonly filesPath = join(process.cwd(), "static", "files");

  @Get("/files/:name")
  async file(@Param("name") name: string, @Res() res: Response) {
    const filePath = join(this.filesPath, name);

    if (!existsSync(filePath)) {
      throw new NotFoundException("File not found");
    }

    return res.sendFile(filePath);
  }

  @Get("*")
  async rootFile(@Req() request: Request, @Res() response: Response) {
    const originalUrl = decodeURIComponent(request.path || "/");

    // Normalize + prevent path traversal: map requested path into clientDistPath
    // If user requests "/" -> serve index.html; else treat as requested file
    const requestRelativePath =
      originalUrl === "/" ? "/index.html" : originalUrl;
    const resolved = normalize(join(this.clientDistPath, requestRelativePath));

    // Safety: ensure resolved path is still inside clientDistPath
    const normalizedDist = normalize(this.clientDistPath + sep);
    if (!resolved.startsWith(normalizedDist)) {
      throw new BadRequestException("Invalid path");
    }

    // If file exists, serve it
    if (existsSync(resolved) && statSync(resolved).isFile()) {
      return response.sendFile(resolved);
    }

    // Fallback to index.html (SPA)
    const indexPath = join(this.clientDistPath, "index.html");
    if (existsSync(indexPath)) {
      return response.sendFile(indexPath);
    }

    // If index missing - respond 404
    throw new NotFoundException("SPA index.html not found");
  }
}
