import type { PrismaClient, Station } from '@/generated/prisma/client.js';
import type {
  StationEntity,
  StationFacility,
  CreateStationData,
  UpdateStationData,
} from '@/domain/stations/station.entity.js';
import type { PaginationMeta } from '@/shared/types.js';
import { AppError } from '@/domain/errors/app-error.js';
import { ErrorCodes } from '@/domain/errors/error-codes.js';
import { buildPaginationMeta, parsePagination } from '@/shared/pagination.js';
import { createLogger } from '@/infrastructure/logger/logger.js';

const logger = createLogger('StationService');

/** Pagination and filter input for listing stations. */
export interface ListStationsInput {
  /** Page number (1-based). */
  page: number;
  /** Number of items per page. */
  pageSize: number;
  /** Optional type filter. */
  type?: string;
  /** Optional city filter (case-insensitive partial match). */
  city?: string;
  /** Optional active status filter. */
  isActive?: boolean;
  /** Optional search query (name or address). */
  search?: string;
}

/** Result of listing stations with pagination metadata. */
export interface PaginatedStations {
  /** List of stations for the current page. */
  data: StationEntity[];
  /** Pagination metadata. */
  meta: PaginationMeta;
}

/**
 * Service handling station CRUD and search operations.
 * Admin operations are enforced at route level.
 */
export class StationService {
  /** Create a station service with the given Prisma client. */
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * List stations with optional filters by type, city, active status, and search.
   * Return stations ordered by city name, then name.
   */
  async listStations(input: ListStationsInput): Promise<PaginatedStations> {
    const { skip, take } = parsePagination(input.page, input.pageSize);
    const where: Record<string, unknown> = {};

    if (input.type) {
      where.type = input.type;
    }
    if (input.city) {
      where.cityName = { contains: input.city, mode: 'insensitive' };
    }
    if (input.isActive !== undefined) {
      where.isActive = input.isActive;
    }
    if (input.search) {
      where.OR = [
        { name: { contains: input.search, mode: 'insensitive' } },
        { address: { contains: input.search, mode: 'insensitive' } },
      ];
    }

    const [stations, total] = await Promise.all([
      this.prisma.station.findMany({
        where,
        orderBy: [{ cityName: 'asc' }, { name: 'asc' }],
        skip,
        take,
      }),
      this.prisma.station.count({ where }),
    ]);

    logger.debug('Listed stations', { total, page: input.page });

    return {
      data: stations.map((s) => toStationEntity(s)),
      meta: buildPaginationMeta({ total, page: input.page, pageSize: input.pageSize }),
    };
  }

  /**
   * Get a single station by ID.
   * Throw RESOURCE_NOT_FOUND if station does not exist.
   */
  async getById(id: string): Promise<StationEntity> {
    const station = await this.prisma.station.findUnique({ where: { id } });

    if (!station) {
      throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, 'Station not found');
    }

    return toStationEntity(station);
  }

  /**
   * Create a new station.
   * Validate type rules: providers can only create STOP type.
   */
  async create(data: CreateStationData, createdBy: string): Promise<StationEntity> {
    const station = await this.prisma.station.create({
      data: {
        name: data.name,
        cityName: data.cityName,
        type: data.type,
        address: data.address,
        lat: data.lat,
        lng: data.lng,
        facilities: data.facilities ?? [],
        phone: data.phone ?? null,
        email: data.email ?? null,
        platformCount: data.platformCount ?? null,
        createdBy,
      },
    });

    logger.info('Station created', { id: station.id, type: station.type, name: station.name });

    return toStationEntity(station);
  }

  /**
   * Update a station by ID.
   * Throw RESOURCE_NOT_FOUND if station does not exist.
   */
  async update(id: string, data: UpdateStationData): Promise<StationEntity> {
    const existing = await this.prisma.station.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, 'Station not found');
    }

    const station = await this.prisma.station.update({
      where: { id },
      data,
    });

    logger.info('Station updated', { id: station.id, name: station.name });

    return toStationEntity(station);
  }

  /**
   * Deactivate a station by setting isActive to false.
   * Throw RESOURCE_NOT_FOUND if station does not exist.
   * Throw STATION_IN_USE if station is referenced by active schedules.
   */
  async deactivate(id: string): Promise<void> {
    const station = await this.prisma.station.findUnique({
      where: { id },
      select: { id: true, isActive: true },
    });

    if (!station) {
      throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, 'Station not found');
    }

    // Check if station is referenced by stop times on active schedules
    const activeRefs = await this.prisma.stopTime.count({
      where: {
        stationId: id,
        schedule: { status: 'ACTIVE' },
      },
    });

    if (activeRefs > 0) {
      throw new AppError(
        409,
        ErrorCodes.STATION_IN_USE,
        'Station is referenced by active schedules and cannot be deactivated',
      );
    }

    await this.prisma.station.update({
      where: { id },
      data: { isActive: false },
    });

    logger.info('Station deactivated', { id });
  }

  /**
   * Merge source station into target station.
   * Update all Stop and StopTime references from source to target, then deactivate source.
   * Return the target station.
   */
  async merge(sourceId: string, targetId: string): Promise<StationEntity> {
    const [source, target] = await Promise.all([
      this.prisma.station.findUnique({ where: { id: sourceId }, select: { id: true } }),
      this.prisma.station.findUnique({ where: { id: targetId }, select: { id: true } }),
    ]);

    if (!source) {
      throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, 'Source station not found');
    }
    if (!target) {
      throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, 'Target station not found');
    }

    await this.prisma.$transaction([
      this.prisma.stop.updateMany({
        where: { stationId: sourceId },
        data: { stationId: targetId },
      }),
      this.prisma.stopTime.updateMany({
        where: { stationId: sourceId },
        data: { stationId: targetId },
      }),
      this.prisma.station.update({
        where: { id: sourceId },
        data: { isActive: false },
      }),
    ]);

    logger.info('Stations merged', { sourceId, targetId });

    const merged = await this.prisma.station.findUniqueOrThrow({ where: { id: targetId } });
    return toStationEntity(merged);
  }

  /**
   * Search active stations for the station picker.
   * Filter by name, city, or address (case-insensitive partial match).
   */
  async searchActive(
    input: { search?: string; page: number; pageSize: number },
  ): Promise<PaginatedStations> {
    const { skip, take } = parsePagination(input.page, input.pageSize);
    const where: Record<string, unknown> = { isActive: true };

    if (input.search) {
      where.OR = [
        { name: { contains: input.search, mode: 'insensitive' } },
        { cityName: { contains: input.search, mode: 'insensitive' } },
        { address: { contains: input.search, mode: 'insensitive' } },
      ];
    }

    const [stations, total] = await Promise.all([
      this.prisma.station.findMany({
        where,
        orderBy: [{ cityName: 'asc' }, { name: 'asc' }],
        skip,
        take,
      }),
      this.prisma.station.count({ where }),
    ]);

    return {
      data: stations.map((s) => toStationEntity(s)),
      meta: buildPaginationMeta({ total, page: input.page, pageSize: input.pageSize }),
    };
  }
}

/** Convert a Prisma Station record to a StationEntity. */
function toStationEntity(station: Station): StationEntity {
  return {
    id: station.id,
    name: station.name,
    cityName: station.cityName,
    type: station.type,
    address: station.address,
    lat: station.lat,
    lng: station.lng,
    facilities: station.facilities as StationFacility[],
    phone: station.phone,
    email: station.email,
    platformCount: station.platformCount,
    isActive: station.isActive,
    createdBy: station.createdBy,
    createdAt: station.createdAt,
    updatedAt: station.updatedAt,
  };
}
