import { Global, Module } from '@nestjs/common';
import { db, type Database } from './index';

export const DRIZZLE = Symbol('DRIZZLE');
export type { Database };

@Global()
@Module({
  providers: [
    {
      provide: DRIZZLE,
      useValue: db,
    },
  ],
  exports: [DRIZZLE],
})
export class DbModule {}
