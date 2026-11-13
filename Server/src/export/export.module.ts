import { Module } from '@nestjs/common';
import { NotesModule } from '../notes/notes.module';
import { ExportController } from './export.controller';
import { ExportService } from './export.service';

@Module({
  imports: [NotesModule],
  controllers: [ExportController],
  providers: [ExportService],
})
export class ExportModule {}
