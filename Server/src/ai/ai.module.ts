import { Module } from '@nestjs/common';
import { NotesModule } from '../notes/notes.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';

@Module({
  imports: [NotesModule],
  controllers: [AiController],
  providers: [AiService],
})
export class AiModule {}
