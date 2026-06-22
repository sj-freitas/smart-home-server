import {
  Controller,
  Get,
  Param,
  Req,
  Res,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { Request, Response } from "express";
import { join, normalize, sep } from "path";
import { existsSync, statSync } from "fs";

@Controller("admin")
export class AdminDashboardController {
  private readonly adminDistPath = join(process.cwd(), "admin");

  @Get()
  async adminRoot(@Res() response: Response) {
    return this.serveIndex(response);
  }

  @Get("*")
  async adminAsset(
    @Req() request: Request,
    @Res() response: Response,
    @Param() _params: unknown,
  ) {
    const originalUrl = decodeURIComponent(request.path || "/admin");

    // Strip the leading /admin prefix since files live in adminDistPath
    const relative = originalUrl.replace(/^\/admin\/?/, "") || "index.html";

    const resolved = normalize(join(this.adminDistPath, relative));

    // Prevent path traversal
    const normalizedDist = normalize(this.adminDistPath + sep);
    if (!resolved.startsWith(normalizedDist)) {
      throw new BadRequestException("Invalid path");
    }

    if (existsSync(resolved) && statSync(resolved).isFile()) {
      return response.sendFile(resolved);
    }

    // Fallback to SPA index
    return this.serveIndex(response);
  }

  private serveIndex(response: Response) {
    const indexPath = join(this.adminDistPath, "index.html");
    if (!existsSync(indexPath)) {
      throw new NotFoundException("Admin dashboard not found");
    }
    return response.sendFile(indexPath);
  }
}
