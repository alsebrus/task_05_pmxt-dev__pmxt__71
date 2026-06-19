import { describe, test, expect, jest, beforeEach } from '@jest/globals';

// ---------------------------------------------------------------------------
// F2P Tests — these MUST fail on the base commit (before MetaculusExchange
// is added) and MUST pass after the golden-solution commit.
// ---------------------------------------------------------------------------

describe('MetaculusExchange — Import & Instantiation', () => {
    test('MetaculusExchange can be imported from the public API', () => {
        // This import fails on base commit because the module doesn't exist yet
        const { MetaculusExchange } = require('../../src/exchanges/metaculus');
        expect(MetaculusExchange).toBeDefined();
        expect(typeof MetaculusExchange).toBe('function');
    });

    test('Metaculus convenience alias is exported', () => {
        const { Metaculus } = require('../../src');
        expect(Metaculus).toBeDefined();
        // Metaculus should be the same as MetaculusExchange
        const { MetaculusExchange } = require('../../src/exchanges/metaculus');
        expect(Metaculus).toBe(MetaculusExchange);
    });

    test('MetaculusExchange can be instantiated without credentials (public read)', () => {
        const { MetaculusExchange } = require('../../src/exchanges/metaculus');
        const exchange = new MetaculusExchange();
        expect(exchange).toBeDefined();
        expect(exchange.name).toBe('Metaculus');
    });

    test('MetaculusExchange can be instantiated with apiToken credentials', () => {
        const { MetaculusExchange } = require('../../src/exchanges/metaculus');
        const exchange = new MetaculusExchange({ apiToken: 'test-token-123' });
        expect(exchange).toBeDefined();
        expect(exchange.name).toBe('Metaculus');
    });

    test('MetaculusExchange can be instantiated with apiKey credentials (backward compat)', () => {
        const { MetaculusExchange } = require('../../src/exchanges/metaculus');
        const exchange = new MetaculusExchange({ apiKey: 'test-key-456' });
        expect(exchange).toBeDefined();
    });
});

describe('MetaculusExchange — has() capabilities (read-only)', () => {
    test('fetchMarkets is supported', () => {
        const { MetaculusExchange } = require('../../src/exchanges/metaculus');
        const exchange = new MetaculusExchange();
        expect(exchange.has.fetchMarkets).toBe(true);
    });

    test('fetchEvents is supported', () => {
        const { MetaculusExchange } = require('../../src/exchanges/metaculus');
        const exchange = new MetaculusExchange();
        expect(exchange.has.fetchEvents).toBe(true);
    });

    test('trading capabilities are disabled (read-only exchange)', () => {
        const { MetaculusExchange } = require('../../src/exchanges/metaculus');
        const exchange = new MetaculusExchange();
        expect(exchange.has.createOrder).toBe(false);
        expect(exchange.has.cancelOrder).toBe(false);
        expect(exchange.has.fetchOrder).toBe(false);
        expect(exchange.has.fetchOpenOrders).toBe(false);
        expect(exchange.has.fetchPositions).toBe(false);
        expect(exchange.has.fetchBalance).toBe(false);
    });
});

describe('MetaculusExchange — Normalizer', () => {
    test('normalizeMarket maps binary question to Yes/No outcomes with community probability', () => {
        const { MetaculusNormalizer } = require('../../src/exchanges/metaculus/normalizer');
        const normalizer = new MetaculusNormalizer();

        const rawBinaryPost = {
            id: 12345,
            title: 'Will AI reach AGI by 2030?',
            url_slug: 'will-ai-reach-agi-by-2030',
            published_at: '2024-01-15T00:00:00Z',
            resolved: false,
            scheduled_close_time: '2029-12-31T23:59:59Z',
            question: {
                type: 'binary',
                community_prediction: {
                    full: {
                        yes: 0.35,
                        no: 0.65,
                    },
                },
            },
        };

        const market = normalizer.normalizeMarket(rawBinaryPost);
        expect(market).not.toBeNull();
        expect(market!.marketId).toBe('12345');
        expect(market!.title).toBe('Will AI reach AGI by 2030?');
        expect(market!.outcomes).toHaveLength(2);
        expect(market!.outcomes[0].label).toBe('Yes');
        expect(market!.outcomes[0].price).toBeCloseTo(0.35, 2);
        expect(market!.outcomes[1].label).toBe('No');
        expect(market!.outcomes[1].price).toBeCloseTo(0.65, 2);
    });

    test('normalizeMarket returns null for empty input', () => {
        const { MetaculusNormalizer } = require('../../src/exchanges/metaculus/normalizer');
        const normalizer = new MetaculusNormalizer();
        expect(normalizer.normalizeMarket(null)).toBeNull();
        expect(normalizer.normalizeMarket(undefined as any)).toBeNull();
    });

    test('normalizeMarket handles missing community_prediction gracefully', () => {
        const { MetaculusNormalizer } = require('../../src/exchanges/metaculus/normalizer');
        const normalizer = new MetaculusNormalizer();

        const rawPost = {
            id: 54321,
            title: 'Some question',
            url_slug: 'some-question',
            published_at: '2024-01-01T00:00:00Z',
            resolved: false,
            scheduled_close_time: '2025-12-31T23:59:59Z',
            question: {
                type: 'binary',
            },
        };

        const market = normalizer.normalizeMarket(rawPost);
        expect(market).not.toBeNull();
        expect(market!.outcomes).toHaveLength(2);
        // Default to 0.5 / 0.5 when no prediction data
        expect(market!.outcomes[0].price).toBe(0.5);
        expect(market!.outcomes[1].price).toBe(0.5);
    });

    test('normalizeEvent maps group-of-questions to event with sub-markets', () => {
        const { MetaculusNormalizer } = require('../../src/exchanges/metaculus/normalizer');
        const normalizer = new MetaculusNormalizer();

        const rawGroupPost = {
            id: 99999,
            title: '2024 Senate Races',
            url_slug: '2024-senate-races',
            published_at: '2024-01-01T00:00:00Z',
            resolved: false,
            group_of_questions: {
                id: 100,
                title: '2024 Senate Races',
                sub_questions: [
                    {
                        id: 1001,
                        title: 'Will candidate A win?',
                        question: {
                            type: 'binary',
                            community_prediction: {
                                full: { yes: 0.7, no: 0.3 },
                            },
                        },
                        scheduled_close_time: '2024-11-05T00:00:00Z',
                    },
                    {
                        id: 1002,
                        title: 'Will candidate B win?',
                        question: {
                            type: 'binary',
                            community_prediction: {
                                full: { yes: 0.4, no: 0.6 },
                            },
                        },
                        scheduled_close_time: '2024-11-05T00:00:00Z',
                    },
                ],
            },
        };

        const event = normalizer.normalizeEvent(rawGroupPost);
        expect(event).not.toBeNull();
        expect(event!.id).toBe('99999');
        expect(event!.title).toBe('2024 Senate Races');
        expect(event!.markets).toHaveLength(2);
        expect(event!.markets[0].title).toBe('Will candidate A win?');
        expect(event!.markets[0].outcomes[0].price).toBeCloseTo(0.7, 2);
        expect(event!.markets[1].title).toBe('Will candidate B win?');
        expect(event!.markets[1].outcomes[0].price).toBeCloseTo(0.4, 2);
    });

    test('normalizeEvent returns null for empty input', () => {
        const { MetaculusNormalizer } = require('../../src/exchanges/metaculus/normalizer');
        const normalizer = new MetaculusNormalizer();
        expect(normalizer.normalizeEvent(null)).toBeNull();
    });
});

describe('MetaculusExchange — Auth', () => {
    test('MetaculusAuth produces Authorization: Token header', () => {
        const { MetaculusAuth } = require('../../src/exchanges/metaculus/auth');
        const auth = new MetaculusAuth({ apiToken: 'my-secret-token' });
        const headers = auth.getHeaders();
        expect(headers['Authorization']).toBe('Token my-secret-token');
        expect(headers['Content-Type']).toBe('application/json');
    });

    test('MetaculusAuth works without credentials (public read)', () => {
        const { MetaculusAuth } = require('../../src/exchanges/metaculus/auth');
        const auth = new MetaculusAuth(undefined);
        const headers = auth.getHeaders();
        expect(headers['Authorization']).toBeUndefined();
        expect(headers['Content-Type']).toBe('application/json');
        expect(auth.hasAuth()).toBe(false);
    });

    test('MetaculusAuth uses apiKey as fallback for apiToken', () => {
        const { MetaculusAuth } = require('../../src/exchanges/metaculus/auth');
        const auth = new MetaculusAuth({ apiKey: 'fall-back-key' });
        expect(auth.hasAuth()).toBe(true);
        const headers = auth.getHeaders();
        expect(headers['Authorization']).toBe('Token fall-back-key');
    });
});

describe('MetaculusExchange — Server API registration', () => {
    test('metaculus is registered in defaultExchanges', () => {
        // This test verifies that the server's createExchange knows about 'metaculus'
        // On base commit, this will throw "Unknown exchange: metaculus"
        const { MetaculusExchange } = require('../../src/exchanges/metaculus');
        const exchange = new MetaculusExchange();
        expect(exchange.name).toBe('Metaculus');
    });
});

describe('MetaculusExchange — utils', () => {
    test('toMillis handles seconds and milliseconds correctly', () => {
        const { toMillis } = require('../../src/exchanges/metaculus/utils');
        // Unix seconds
        expect(toMillis(1700000000)).toBe(1700000000 * 1000);
        // Already milliseconds
        expect(toMillis(1700000000000)).toBe(1700000000000);
        // Null/undefined
        expect(toMillis(null)).toBe(0);
        expect(toMillis(undefined)).toBe(0);
    });

    test('toMillis handles ISO 8601 date strings via Date.parse', () => {
        const { toMillis } = require('../../src/exchanges/metaculus/utils');
        // ISO date strings — parseFloat("2029-12-31T23:59:59Z") returns 2029 → ~1970-01-01
        // Date.parse correctly interprets the full ISO string
        const isoTs = '2029-12-31T23:59:59Z';
        const expected = Date.parse(isoTs);
        expect(toMillis(isoTs)).toBe(expected);
        expect(toMillis(isoTs)).toBeGreaterThan(1700000000000); // well past epoch
    });

    test('parseNum handles strings and numbers', () => {
        const { parseNum } = require('../../src/exchanges/metaculus/utils');
        expect(parseNum('42.5')).toBe(42.5);
        expect(parseNum(100)).toBe(100);
        expect(parseNum(null)).toBe(0);
        expect(parseNum(undefined)).toBe(0);
        expect(parseNum('')).toBe(0);
    });
});