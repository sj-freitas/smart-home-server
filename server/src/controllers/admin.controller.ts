import {
  BadRequestException,
  Controller,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Request } from "express";
import { ApiKeyGuard } from "../services/api-key.guard";
import { z } from "zod";
import {
  EmailsPersistenceService,
  RoleZod,
} from "../services/auth/emails.persistence.service";

const AddAccessToEmailBodyRequestZod = z
  .object({
    emailAddress: z.string(),
    role: RoleZod,
    startDate: z.iso.datetime(),
    endDate: z.iso.datetime(),
  })
  .transform((t) => ({
    emailAddress: t.emailAddress,
    role: t.role,
    startDate: new Date(t.startDate),
    endDate: new Date(t.endDate),
  }));

/**
 * Current authentication via API Key only. The API key flow is incredibly
 * limited, only for special use cases - the roles it grants are unrelated
 * to the API key itself.
 */
@Controller("api/admin")
@UseGuards(ApiKeyGuard)
export class AdminController {
  constructor(
    private readonly emailsPersistenceService: EmailsPersistenceService,
  ) {}

  @Post("/access")
  public async addAccessToEmail(@Req() request: Request) {
    const parsedBody = AddAccessToEmailBodyRequestZod.safeParse(request.body);

    if (parsedBody.error) {
      throw new BadRequestException();
    }

    const { emailAddress, role, startDate, endDate } = parsedBody.data;

    if (endDate.getTime() < startDate.getTime()) {
      throw new BadRequestException(`endDate cannot be prior to startDate.`);
    }

    return await this.emailsPersistenceService.addEmail(
      emailAddress,
      role,
      startDate,
      endDate,
    );
  }
}
