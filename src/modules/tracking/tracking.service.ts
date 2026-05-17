import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TrackingService {
  private googleMapsApiKey: string;

  constructor(
    private redisService: RedisService,
    private configService: ConfigService,
  ) {
    this.googleMapsApiKey = this.configService.get('GOOGLE_MAPS_API_KEY') || '';
  }

  async updateErranderLocation(
    erranderId: string,
    coordinates: number[],
  ): Promise<void> {
    // Store in Redis for real-time access
    await this.redisService.geoadd(
      'erranders:locations',
      coordinates[0],
      coordinates[1],
      erranderId,
    );

    // Store current position
    await this.redisService.setJSON(
      `errander:location:${erranderId}`,
      { coordinates, updatedAt: new Date() },
      300,
    );
  }

  async getErranderLocation(
    erranderId: string,
  ): Promise<{ coordinates: number[]; updatedAt: string } | null> {
    return this.redisService.getJSON(`errander:location:${erranderId}`);
  }

  async getOrderTrackingInfo(orderId: string) {
    const tracking = await this.redisService.getJSON<any>(
      `order:tracking:${orderId}`,
    );
    return tracking;
  }

  async updateOrderTracking(
    orderId: string,
    data: {
      erranderLocation: number[];
      status: string;
      estimatedArrival?: string;
    },
  ): Promise<void> {
    await this.redisService.setJSON(
      `order:tracking:${orderId}`,
      { ...data, updatedAt: new Date() },
      3600,
    );
  }

  async calculateDistance(
    origin: number[],
    destination: number[],
  ): Promise<{ distance: string; duration: string } | null> {
    try {
      const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin[1]},${origin[0]}&destinations=${destination[1]},${destination[0]}&key=${this.googleMapsApiKey}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.rows?.[0]?.elements?.[0]?.status === 'OK') {
        return {
          distance: data.rows[0].elements[0].distance.text,
          duration: data.rows[0].elements[0].duration.text,
        };
      }
      return null;
    } catch {
      return null;
    }
  }
}
