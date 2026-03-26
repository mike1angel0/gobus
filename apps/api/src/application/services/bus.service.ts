import type { PrismaClient, Bus, Seat } from '@/generated/prisma/client.js';
import type {
  BusEntity,
  BusWithSeats,
  SeatEntity,
  CreateBusData,
  UpdateBusData,
  BusTemplate,
} from '@/domain/buses/bus.entity.js';
import type { PaginationMeta } from '@/shared/types.js';
import { BUS_TEMPLATES, findTemplateById } from '@/domain/buses/bus-templates.js';
import { AppError } from '@/domain/errors/app-error.js';
import { ErrorCodes } from '@/domain/errors/error-codes.js';
import { verifyOwnership } from '@/domain/errors/ownership.js';
import { buildPaginationMeta, parsePagination } from '@/shared/pagination.js';
import { createLogger } from '@/infrastructure/logger/logger.js';

const logger = createLogger('BusService');

/** Pagination input for listing buses. */
export interface BusPaginationInput {
  /** Page number (1-based). */
  page: number;
  /** Number of items per page. */
  pageSize: number;
}

/** Result of listing buses with pagination metadata. */
export interface PaginatedBuses {
  /** List of buses for the current page. */
  data: BusEntity[];
  /** Pagination metadata. */
  meta: PaginationMeta;
}

/**
 * Service handling bus CRUD operations with ownership enforcement.
 * All operations scope buses to the authenticated provider.
 */
export class BusService {
  /** Create a bus service with the given Prisma client. */
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * List buses belonging to a provider with pagination.
   * Return buses ordered by creation date (newest first).
   */
  async listByProvider(
    providerId: string,
    pagination: BusPaginationInput,
  ): Promise<PaginatedBuses> {
    const { skip, take } = parsePagination(pagination.page, pagination.pageSize);

    const [buses, total] = await Promise.all([
      this.prisma.bus.findMany({
        where: { providerId },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        select: {
          id: true,
          licensePlate: true,
          model: true,
          capacity: true,
          rows: true,
          columns: true,
          providerId: true,
          createdAt: true,
        },
      }),
      this.prisma.bus.count({ where: { providerId } }),
    ]);

    return {
      data: buses.map((b) => this.toBusEntity(b)),
      meta: buildPaginationMeta({ total, page: pagination.page, pageSize: pagination.pageSize }),
    };
  }

  /**
   * Retrieve a bus by ID with ownership check.
   * Return the bus with its full seat layout.
   * Throw NOT_FOUND if the bus does not exist or belongs to another provider.
   */
  async getById(id: string, providerId: string): Promise<BusWithSeats> {
    const bus = await this.prisma.bus.findUnique({
      where: { id },
      include: { seats: { orderBy: [{ row: 'asc' }, { column: 'asc' }] } },
    });

    verifyOwnership(bus, bus?.providerId, providerId, 'Bus');

    return this.toBusWithSeats(bus);
  }

  /**
   * Create a new bus with its seat layout in a single transaction.
   * Support template-based creation when seats match a known template.
   * Return the created bus with seats.
   * Throw CONFLICT if the license plate already exists.
   */
  async create(providerId: string, data: CreateBusData): Promise<BusWithSeats> {
    const existing = await this.prisma.bus.findUnique({
      where: { licensePlate: data.licensePlate },
      select: { id: true },
    });

    if (existing) {
      throw new AppError(409, ErrorCodes.CONFLICT, 'License plate already exists');
    }

    const bus = await this.prisma.$transaction(async (tx) => {
      return tx.bus.create({
        data: {
          licensePlate: data.licensePlate,
          model: data.model,
          capacity: data.capacity,
          rows: data.rows,
          columns: data.columns,
          providerId,
          seats: {
            create: data.seats.map((seat) => ({
              row: seat.row,
              column: seat.column,
              label: seat.label,
              type: seat.type,
              price: seat.price ?? 0,
              isEnabled: seat.type !== 'BLOCKED',
            })),
          },
        },
        include: { seats: { orderBy: [{ row: 'asc' }, { column: 'asc' }] } },
      });
    });

    logger.info('Bus created', { busId: bus.id, providerId });

    return this.toBusWithSeats(bus);
  }

  /**
   * Update a bus by ID with ownership check.
   * Update only metadata fields (licensePlate, model, capacity).
   * Throw NOT_FOUND if the bus does not exist or belongs to another provider.
   * Throw CONFLICT if the new license plate already exists on another bus.
   */
  async update(id: string, providerId: string, data: UpdateBusData): Promise<BusWithSeats> {
    const bus = await this.prisma.bus.findUnique({
      where: { id },
      select: { providerId: true },
    });

    verifyOwnership(bus, bus?.providerId, providerId, 'Bus');

    if (data.licensePlate) {
      const conflict = await this.prisma.bus.findUnique({
        where: { licensePlate: data.licensePlate },
        select: { id: true },
      });

      if (conflict && conflict.id !== id) {
        throw new AppError(409, ErrorCodes.CONFLICT, 'License plate already exists');
      }
    }

    const updateData: Record<string, unknown> = {};
    if (data.licensePlate !== undefined) updateData.licensePlate = data.licensePlate;
    if (data.model !== undefined) updateData.model = data.model;
    if (data.capacity !== undefined) updateData.capacity = data.capacity;

    const updated = await this.prisma.bus.update({
      where: { id },
      data: updateData,
      include: { seats: { orderBy: [{ row: 'asc' }, { column: 'asc' }] } },
    });

    logger.info('Bus updated', { busId: id, providerId });

    return this.toBusWithSeats(updated);
  }

  /**
   * Delete a bus by ID with ownership check.
   * Verify no active schedules reference the bus before deletion.
   * Throw NOT_FOUND if the bus does not exist or belongs to another provider.
   * Throw CONFLICT if active schedules reference the bus.
   */
  async delete(id: string, providerId: string): Promise<void> {
    const bus = await this.prisma.bus.findUnique({
      where: { id },
      select: { providerId: true },
    });

    verifyOwnership(bus, bus?.providerId, providerId, 'Bus');

    const activeScheduleCount = await this.prisma.schedule.count({
      where: { busId: id, status: 'ACTIVE' },
    });

    if (activeScheduleCount > 0) {
      throw new AppError(409, ErrorCodes.CONFLICT, 'Cannot delete bus with active schedules');
    }

    await this.prisma.bus.delete({ where: { id } });

    logger.info('Bus deleted', { busId: id, providerId });
  }

  /**
   * Return all available bus templates.
   * Templates define predefined seat layouts for common bus models.
   */
  getTemplates(): BusTemplate[] {
    return [...BUS_TEMPLATES];
  }

  /**
   * Look up a bus template by its identifier.
   * Return undefined if the template is not found.
   */
  getTemplateById(templateId: string): BusTemplate | undefined {
    return findTemplateById(templateId);
  }

  /** Convert a Prisma Bus record to a BusEntity. */
  private toBusEntity(bus: Bus): BusEntity {
    return {
      id: bus.id,
      licensePlate: bus.licensePlate,
      model: bus.model,
      capacity: bus.capacity,
      rows: bus.rows,
      columns: bus.columns,
      providerId: bus.providerId,
      createdAt: bus.createdAt,
    };
  }

  /** Convert a Prisma Bus with seats to a BusWithSeats entity. */
  private toBusWithSeats(bus: Bus & { seats: Seat[] }): BusWithSeats {
    return {
      ...this.toBusEntity(bus),
      seats: bus.seats.map((s) => this.toSeatEntity(s)),
    };
  }

  /** Convert a Prisma Seat record to a SeatEntity. */
  private toSeatEntity(seat: Seat): SeatEntity {
    return {
      id: seat.id,
      row: seat.row,
      column: seat.column,
      label: seat.label,
      type: seat.type,
      price: seat.price,
      isEnabled: seat.isEnabled,
    };
  }
}
