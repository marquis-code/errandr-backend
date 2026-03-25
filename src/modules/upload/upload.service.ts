import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';

@Injectable()
export class UploadService {
  constructor(private configService: ConfigService) {
    cloudinary.config({
      cloud_name: this.configService.get('CLOUDINARY_CLOUD_NAME'),
      api_key: this.configService.get('CLOUDINARY_API_KEY'),
      api_secret: this.configService.get('CLOUDINARY_API_SECRET'),
    });
  }

  async uploadFile(
    file: Express.Multer.File,
    resourceType: 'image' | 'video' | 'raw' | 'auto' = 'auto',
    folder = 'errandr',
  ): Promise<{ url: string; publicId: string }> {
    if (!file) throw new BadRequestException('No file provided');

    return new Promise((resolve, reject) => {
      const options: any = {
        folder,
        resource_type: resourceType,
      };

      if (resourceType === 'image') {
        options.transformation = [
          { width: 1200, height: 1200, crop: 'limit' },
          { quality: 'auto' },
          { fetch_format: 'auto' },
        ];
      }

      cloudinary.uploader
        .upload_stream(
          options,
          (error, result: UploadApiResponse) => {
            if (error) return reject(error);
            resolve({
              url: result.secure_url,
              publicId: result.public_id,
            });
          },
        )
        .end(file.buffer);
    });
  }

  async uploadImage(
    file: Express.Multer.File,
    folder = 'errandr'
  ): Promise<{ url: string; publicId: string }> {
    return this.uploadFile(file, 'image', folder);
  }

  async uploadMultiple(
    files: Express.Multer.File[],
    folder = 'errandr',
  ): Promise<{ url: string; publicId: string }[]> {
    return Promise.all(files.map((file) => this.uploadImage(file, folder)));
  }

  async deleteImage(publicId: string): Promise<void> {
    await cloudinary.uploader.destroy(publicId);
  }
}
