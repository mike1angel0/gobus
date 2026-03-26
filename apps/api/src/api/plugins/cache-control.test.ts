import { describe, it, expect, vi } from 'vitest';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { cachePublic, cachePrivate, noCache, privateNoCache } from './cache-control.js';

function createMockReply(): FastifyReply {
  const reply = {
    header: vi.fn().mockReturnThis(),
  } as unknown as FastifyReply;
  return reply;
}

const mockRequest = {} as FastifyRequest;

describe('cache-control helpers', () => {
  it('cachePublic sets public, max-age header', async () => {
    const reply = createMockReply();
    const handler = cachePublic(30);
    await handler(mockRequest, reply);
    expect(reply.header).toHaveBeenCalledWith('Cache-Control', 'public, max-age=30');
  });

  it('cachePublic with different max-age', async () => {
    const reply = createMockReply();
    const handler = cachePublic(3600);
    await handler(mockRequest, reply);
    expect(reply.header).toHaveBeenCalledWith('Cache-Control', 'public, max-age=3600');
  });

  it('cachePrivate sets private, max-age header', async () => {
    const reply = createMockReply();
    const handler = cachePrivate(60);
    await handler(mockRequest, reply);
    expect(reply.header).toHaveBeenCalledWith('Cache-Control', 'private, max-age=60');
  });

  it('noCache sets no-cache, no-store, must-revalidate header', async () => {
    const reply = createMockReply();
    await noCache(mockRequest, reply);
    expect(reply.header).toHaveBeenCalledWith(
      'Cache-Control',
      'no-cache, no-store, must-revalidate',
    );
  });

  it('privateNoCache sets private, no-cache header', async () => {
    const reply = createMockReply();
    await privateNoCache(mockRequest, reply);
    expect(reply.header).toHaveBeenCalledWith('Cache-Control', 'private, no-cache');
  });
});
