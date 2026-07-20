  import {
  Controller, Post, UploadedFile, UploadedFiles,
  UseInterceptors, UseGuards, Query,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { UploadService } from './upload.service';
import { JwtAuthGuard } from '../../common/decorators';
import { memoryStorage } from 'multer';

@ApiTags('Upload')
@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('image')
  @ApiOperation({ summary: 'Upload a single image (public)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    }),
  )
  uploadImage(@UploadedFile() file: Express.Multer.File) {
    return this.uploadService.uploadImage(file);
  }

  @Post('images')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload multiple images' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FilesInterceptor('files', 5, {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  uploadMultiple(@UploadedFiles() files: Express.Multer.File[]) {
    return this.uploadService.uploadMultiple(files);
  }

  @Post()
  @ApiOperation({ summary: 'Upload a single file (generic)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    }),
  )
  uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Query('resourceType') resourceType: 'image' | 'video' | 'raw' | 'auto' | 'audio' = 'auto'
  ) {
    const cloudinaryResourceType = resourceType === 'audio' ? 'video' : (resourceType as 'image' | 'video' | 'raw' | 'auto');
    return this.uploadService.uploadFile(file, cloudinaryResourceType);
  }
}
