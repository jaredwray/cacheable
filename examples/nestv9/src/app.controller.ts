import { CACHE_MANAGER, Controller, Get, Inject } from '@nestjs/common';

import { Cache } from 'cache-manager';

@Controller()
export class AppController {
  constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {
    console.log(this.cache);
  }

  @Get()
  getHello(): string {
    return JSON.stringify(this.cache);
  }
}
