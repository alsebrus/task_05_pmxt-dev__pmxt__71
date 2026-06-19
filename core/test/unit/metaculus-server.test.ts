import { describe, test, expect, jest, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import type { Server } from 'http';

const TEST_TOKEN = 'test-token-123';

const mockInstance: Record<string, any> = {
    fetchMarkets: jest.fn().mockResolvedValue([]),
    fetchEvents: jest.fn().mockResolvedValue([]),
    verbose: false,
};

const metaculusCtor = jest.fn().mockImplementation(() => mockInstance);

jest.mock('../../src/exchanges/metaculus', () => ({
    MetaculusExchange: metaculusCtor,
}));

jest.spyOn(console, 'error').mockImplementation(() => {});

import { startServer } from '../../src/server/app';

let server: Server;

beforeAll(async () => {
    server = await startServer(0, TEST_TOKEN) as unknown as Server;
});

afterAll(() => {
    server?.close();
});

beforeEach(() => {
    mockInstance.verbose = false;
    mockInstance.fetchMarkets = jest.fn().mockResolvedValue([]);
    mockInstance.fetchEvents = jest.fn().mockResolvedValue([]);
});

describe('Metaculus exchange API', () => {
    test('metaculus singleton is reused on second call without credentials', async () => {
        const initialCalls = metaculusCtor.mock.calls.length;

        await request(server)
            .post('/api/metaculus/fetchMarkets')
            .set('x-pmxt-access-token', TEST_TOKEN)
            .send({ args: [] });

        await request(server)
            .post('/api/metaculus/fetchMarkets')
            .set('x-pmxt-access-token', TEST_TOKEN)
            .send({ args: [] });

        expect(metaculusCtor.mock.calls.length - initialCalls).toBe(1);
    });

    test('POST /api/metaculus/fetchMarkets returns 200', async () => {
        mockInstance.fetchMarkets = jest.fn().mockResolvedValue([
            { marketId: '1', title: 'Test Market', outcomes: [] },
        ]);

        const res = await request(server)
            .post('/api/metaculus/fetchMarkets')
            .set('x-pmxt-access-token', TEST_TOKEN)
            .send({ args: [] });

        expect(res.status).toBe(200);
        expect(res.body).toBeDefined();
    });

    test('POST /api/metaculus/fetchMarkets with apiToken credentials', async () => {
        const initialCalls = metaculusCtor.mock.calls.length;

        await request(server)
            .post('/api/metaculus/fetchMarkets')
            .set('x-pmxt-access-token', TEST_TOKEN)
            .send({ args: [], credentials: { apiToken: 'meta-token-123' } });

        expect(metaculusCtor.mock.calls.length - initialCalls).toBe(1);
        expect(metaculusCtor.mock.calls[metaculusCtor.mock.calls.length - 1][0]).toEqual(
            expect.objectContaining({ apiToken: 'meta-token-123' }),
        );
    });
});
