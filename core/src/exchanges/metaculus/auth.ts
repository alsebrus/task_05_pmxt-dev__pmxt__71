import { ExchangeCredentials } from '../../BaseExchange';

/**
 * Manages API token authentication for Metaculus.
 * Read operations work without authentication (public data).
 * Authenticated requests use Authorization: Token <api_token> header.
 */
export class MetaculusAuth {
    private readonly apiToken?: string;

    constructor(credentials?: ExchangeCredentials) {
        this.apiToken = credentials?.apiToken || credentials?.apiKey;
    }

    getHeaders(): Record<string, string> {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };
        if (this.apiToken) {
            headers['Authorization'] = `Token ${this.apiToken}`;
        }
        return headers;
    }

    hasAuth(): boolean {
        return !!this.apiToken;
    }
}