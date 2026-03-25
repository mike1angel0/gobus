import type { PrismaClient, Provider } from '@/generated/prisma/client.js';
import type { ProviderEntity, ProviderUpdateData } from '@/domain/providers/provider.entity.js';
import { AppError } from '@/domain/errors/app-error.js';
import { ErrorCodes } from '@/domain/errors/error-codes.js';
import { createLogger } from '@/infrastructure/logger/logger.js';

const logger = createLogger('ProviderService');

/**
 * Service handling provider profile operations including
 * lookup by ID, lookup by user, and profile updates.
 */
export class ProviderService {
  /** Create a provider service with the given Prisma client. */
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Retrieve a provider by its unique ID.
   * Throws NOT_FOUND if the provider does not exist.
   */
  async getById(id: string): Promise<ProviderEntity> {
    const provider = await this.prisma.provider.findUnique({
      where: { id },
    });

    if (!provider) {
      throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, 'Provider not found');
    }

    return this.toEntity(provider);
  }

  /**
   * Resolve the provider profile for a user by their providerId.
   * Throws NOT_FOUND if the user has no associated provider.
   */
  async getByUserId(userId: string): Promise<ProviderEntity> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { provider: true },
    });

    if (!user?.provider) {
      throw new AppError(
        404,
        ErrorCodes.RESOURCE_NOT_FOUND,
        'No provider associated with this user',
      );
    }

    return this.toEntity(user.provider);
  }

  /**
   * Update a provider's profile fields. Only provided fields are updated.
   * Returns the updated provider entity.
   */
  async updateProfile(providerId: string, data: ProviderUpdateData): Promise<ProviderEntity> {
    const existing = await this.prisma.provider.findUnique({
      where: { id: providerId },
    });

    if (!existing) {
      throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, 'Provider not found');
    }

    const updated = await this.prisma.provider.update({
      where: { id: providerId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.logo !== undefined && { logo: data.logo }),
        ...(data.contactEmail !== undefined && { contactEmail: data.contactEmail }),
        ...(data.contactPhone !== undefined && { contactPhone: data.contactPhone }),
      },
    });

    logger.info('Provider profile updated', { providerId });

    return this.toEntity(updated);
  }

  /**
   * Convert a Prisma Provider record to a public ProviderEntity.
   */
  private toEntity(provider: Provider): ProviderEntity {
    return {
      id: provider.id,
      name: provider.name,
      logo: provider.logo,
      contactEmail: provider.contactEmail,
      contactPhone: provider.contactPhone,
      status: provider.status,
      createdAt: provider.createdAt,
      updatedAt: provider.updatedAt,
    };
  }
}
