import {
    PredictionMarketExchange,
    MarketFilterParams,
    ExchangeCredentials,
    EventFetchParams,
} from '../../BaseExchange';
import {
    UnifiedMarket,
    UnifiedEvent,
} from '../../types';
import { MetaculusAuth } from './auth';
import { MetaculusFetcher } from './fetcher';
import { MetaculusNormalizer } from './normalizer';
import { metaculusErrorMapper } from './errors';
import { FetcherContext } from '../interfaces';

// OpenAPI spec reference: ./api

/**
 * MetaculusExchange — read-only prediction market exchange for Metaculus.
 *
 * Supports:
 *   - fetchMarkets: binary questions → Yes/No outcomes with community probability
 *   - fetchEvents: groups of questions → one event with multiple sub-markets
 *
 * Authentication: optional API token for increased rate limits.
 *   - Pass { apiToken: "..." } or { apiKey: "..." } in credentials.
 *   - Without auth, public data is still accessible.
 */
export class MetaculusExchange extends PredictionMarketExchange {
    override readonly has = {
        fetchMarkets: true as const,
        fetchEvents: true as const,
        fetchOHLCV: false as const,
        fetchOrderBook: false as const,
        fetchTrades: false as const,
        createOrder: false as const,
        cancelOrder: false as const,
        fetchOrder: false as const,
        fetchOpenOrders: false as const,
        fetchPositions: false as const,
        fetchBalance: false as const,
        watchAddress: false as const,
        unwatchAddress: false as const,
        watchOrderBook: false as const,
        watchTrades: false as const,
        fetchMyTrades: false as const,
        fetchClosedOrders: false as const,
        fetchAllOrders: false as const,
        buildOrder: false as const,
        submitOrder: false as const,
    };

    private auth: MetaculusAuth;
    private readonly fetcher: MetaculusFetcher;
    private readonly normalizer: MetaculusNormalizer;

    constructor(credentials?: ExchangeCredentials) {
        super(credentials);
        this.rateLimit = 600; // Metaculus rate limit: ~1 req/sec for unauthenticated

        this.auth = new MetaculusAuth(credentials);

        const ctx: FetcherContext = {
            http: this.http,
            callApi: this.callApi.bind(this),
            getHeaders: () => this.auth.getHeaders(),
        };
        this.fetcher = new MetaculusFetcher(ctx);
        this.normalizer = new MetaculusNormalizer();
    }

    get name(): string {
        return 'Metaculus';
    }

    // -------------------------------------------------------------------------
    // Auth
    // -------------------------------------------------------------------------

    protected override sign(
        _method: string,
        _path: string,
        _params: Record<string, any>,
    ): Record<string, string> {
        return this.auth.getHeaders();
    }

    protected override mapImplicitApiError(error: any): any {
        throw metaculusErrorMapper.mapError(error);
    }

    // -------------------------------------------------------------------------
    // Market Data (read-only)
    // -------------------------------------------------------------------------

    protected async fetchMarketsImpl(params?: MarketFilterParams): Promise<UnifiedMarket[]> {
        const rawPosts = await this.fetcher.fetchRawMarkets(params);
        return rawPosts
            .map((raw) => this.normalizer.normalizeMarket(raw))
            .filter((m): m is UnifiedMarket => m !== null);
    }

    protected async fetchEventsImpl(params: EventFetchParams): Promise<UnifiedEvent[]> {
        const rawPosts = await this.fetcher.fetchRawEvents(params);
        return rawPosts
            .map((raw) => this.normalizer.normalizeEvent(raw))
            .filter((e): e is UnifiedEvent => e !== null);
    }
}