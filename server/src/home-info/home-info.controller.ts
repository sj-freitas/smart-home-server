import { Controller, Get, NotFoundException, Param, Res } from "@nestjs/common";
import { Response } from "express";
import { marked } from "marked";
import { ConfigService } from "../config/config-service";
import { HomeInfoPersistenceService } from "./home-info.persistence.service";

const PAGE_STYLE = `
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
      Helvetica, Arial, sans-serif;
    line-height: 1.6;
    color: #1f2328;
    max-width: 46rem;
    margin: 0 auto;
    padding: 2.5rem 1.5rem;
  }
  h1, h2, h3, h4, h5, h6 {
    line-height: 1.25;
    margin-top: 1.5em;
    margin-bottom: 0.5em;
  }
  p, ul, ol, blockquote, table {
    margin-top: 0;
    margin-bottom: 1em;
  }
  img {
    max-width: 100%;
    height: auto;
    border-radius: 8px;
  }
  code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    background: #f2f2f5;
    padding: 0.15em 0.4em;
    border-radius: 4px;
  }
  pre code {
    display: block;
    padding: 1em;
    overflow-x: auto;
  }
  blockquote {
    margin-left: 0;
    padding-left: 1em;
    border-left: 4px solid #d0d7de;
    color: #57606a;
  }
  a {
    color: #0969da;
  }
  .home-info-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
  }
  .home-info-header img {
    max-width: 3rem;
    max-height: 3rem;
    border-radius: 8px;
  }
  .home-info-header h1 {
    margin: 0;
  }
  @media (prefers-color-scheme: dark) {
    body {
      color: #e6edf3;
      background: #0d1117;
    }
    code {
      background: #21262d;
    }
    blockquote {
      border-left-color: #30363d;
      color: #8b949e;
    }
    a {
      color: #4493f8;
    }
  }
`;

@Controller("home-info")
export class HomeInfoController {
  constructor(
    private readonly configService: ConfigService,
    private readonly homeInfoPersistenceService: HomeInfoPersistenceService,
  ) {}

  @Get("/:homeId")
  public async getHomeInfo(
    @Param("homeId") homeId: string,
    @Res() response: Response,
  ) {
    const {
      homeId: configuredHomeId,
      name,
      iconUrl,
      faviconUrl,
    } = this.configService.getConfig().home;

    if (homeId !== configuredHomeId) {
      throw new NotFoundException("Home not found");
    }

    const homeInfo =
      await this.homeInfoPersistenceService.getLatestByHomeId(homeId);

    if (!homeInfo) {
      throw new NotFoundException("Home info not found");
    }

    const contentHtml = await marked.parse(homeInfo.markdown);
    const faviconLink = faviconUrl
      ? `<link rel="icon" href="${faviconUrl}" />`
      : "";
    const headerHtml = iconUrl
      ? `<div class="home-info-header"><img src="${iconUrl}" alt="${name} icon" /><h1>${name}</h1></div>`
      : "";

    response.set("Content-Type", "text/html; charset=utf-8");
    return response.send(
      `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>${name}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    ${faviconLink}
    <style>${PAGE_STYLE}</style>
  </head>
  <body>
    ${headerHtml}
    ${contentHtml}
  </body>
</html>`,
    );
  }
}
