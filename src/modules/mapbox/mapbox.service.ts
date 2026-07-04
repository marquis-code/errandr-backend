import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class MapboxService {
  private readonly logger = new Logger(MapboxService.name);
  private readonly accessToken: string;

  constructor(private configService: ConfigService) {
    this.accessToken = this.configService.get<string>('MAPBOX_ACCESS_TOKEN') || '';
  }

  /**
   * Fetch [longitude, latitude] for a given text address.
   */
  async geocode(address: string): Promise<[number, number] | null> {
    if (!this.accessToken) {
      this.logger.warn('MAPBOX_ACCESS_TOKEN is missing. Geocoding disabled.');
      return null;
    }

    try {
      const url = `https://api.mapbox.com/search/geocode/v6/forward?q=${encodeURIComponent(address)}&access_token=${this.accessToken}&limit=1`;
      const response = await axios.get<any>(url);
      
      const features = response.data?.features;
      if (features && features.length > 0) {
        // Mapbox returns [longitude, latitude]
        return features[0].geometry.coordinates as [number, number];
      }
      return null;
    } catch (error: any) {
      this.logger.error(`Geocoding failed for address: ${address}`, error.message);
      return null;
    }
  }

  /**
   * Fetch the driving distance in kilometers between two coordinates.
   * coord1 and coord2 should be [longitude, latitude]
   */
  async getDrivingDistance(coord1: [number, number], coord2: [number, number]): Promise<number | null> {
    if (!this.accessToken) {
      this.logger.warn('MAPBOX_ACCESS_TOKEN is missing. Driving distance disabled.');
      return null;
    }

    try {
      const coordinatesStr = `${coord1[0]},${coord1[1]};${coord2[0]},${coord2[1]}`;
      const url = `https://api.mapbox.com/directions-matrix/v1/mapbox/driving/${coordinatesStr}?annotations=distance&access_token=${this.accessToken}`;
      
      const response = await axios.get<any>(url);
      
      const distances = response.data?.distances;
      if (distances && distances[0] && distances[0][1] !== null) {
        const distanceInMeters = distances[0][1];
        return distanceInMeters / 1000; // Convert to km
      }
      return null;
    } catch (error: any) {
      this.logger.error('Failed to calculate driving distance.', error.message);
      return null;
    }
  }
}
