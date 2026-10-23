import { Controller, Get } from "@nestjs/common";
import type { ApiHealthResponse } from "@agenda-app/shared";

@Controller("health")
export class HealthController {
  @Get()
  getHealth(): ApiHealthResponse {
    return {
      status: "ok",
      service: "agenda-api",
    };
  }
}
