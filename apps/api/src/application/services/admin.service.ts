import type { PrismaClient, Bus, Seat } from '@/generated/prisma/client.js';
import type { BusEntity, SeatEntity } from '@/domain/buses/bus.entity.js';
import type { PaginationMeta } from '@/shared/types.js';
import { AppError } from '@/domain/errors/app-error.js';
import { ErrorCodes } from '@/domain/errors/error-codes.js';
import { buildPaginationMeta, parsePagination } from '@/shared/pagination.js';
import { createLogger } from '@/infrastructure/logger/logger.js';

const logger = createLogger('AdminService');

/** Pagination and filter input for listing all buses. */
export interface AdminListBusesInput {
  /** Page number (1-based). */
  page: number;
  /** Number of items per page. */
  pageSize: number;
  /** Optional provider ID to filter buses. */
  providerId?: string;
}

/** Result of listing all buses with pagination metadata. */
export interface PaginatedAdminBuses {
  /** List of buses for the current page. */
  data: BusEntity[];
  /** Pagination metadata. */
  meta: PaginationMeta;
}

/**
 * Service handling admin operations across all providers.
 * All operations require ADMIN role (enforced at route level).
 */
export class AdminService {
  /** Create an admin service with the given Prisma client. */
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * List all buses across all providers with optional provider filter.
   * Return buses ordered by creation date (newest first).
   */
  async listAllBuses(input: AdminListBusesInput): Promise<PaginatedAdminBuses> {
    const { skip, take } = parsePagination(input.page, input.pageSize);
    const where = input.providerId ? { providerId: input.providerId } : {};

    const [buses, total] = await Promise.all([
      this.prisma.bus.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.bus.count({ where }),
    ]);

    logger.debug('Listed all buses', { total, page: input.page });

    return {
      data: buses.map((b) => toBusEntity(b)),
      meta: buildPaginationMeta({ total, page: input.page, pageSize: input.pageSize }),
    };
  }

  /**
   * Toggle the enabled status of a seat.
   * Return the updated seat entity.
   * Throw RESOURCE_NOT_FOUND if the seat does not exist.
   */
  async toggleSeat(seatId: string, isEnabled: boolean): Promise<SeatEntity> {
    const seat = await this.prisma.seat.findUnique({ where: { id: seatId } });

    if (!seat) {
      throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, 'Seat not found');
    }

    const updated = await this.prisma.seat.update({
      where: { id: seatId },
      data: { isEnabled },
    });

    logger.info('Seat toggled', { seatId, isEnabled });

    return toSeatEntity(updated);
  }
}

/** Convert a Prisma Bus record to a BusEntity. */
function toBusEntity(bus: Bus): BusEntity {
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

/** Convert a Prisma Seat record to a SeatEntity. */
function toSeatEntity(seat: Seat): SeatEntity {
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
