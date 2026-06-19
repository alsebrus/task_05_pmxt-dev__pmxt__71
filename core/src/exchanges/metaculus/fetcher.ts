import { MarketFilterParams, EventFetchParams } from '../../BaseExchange';
import { IExchangeFetcher, FetcherContext } from '../interfaces';
import { metaculusErrorMapper } from './errors';
import { BASE_URL } from './utils';

// ----------------------------------------------------------------------------
// Raw Metaculus API response types
// ----------------------------------------------------------------------------

/** A single post from the Metaculus API */
export interface MetaculusRawPost {
    id: number;
    title: string;
    url_slug: string;
    short_title?: string;
    published_at: string;
    resolved: boolean;
    resolution?: number | null;
    close_time?: string;
    open_time?: string;
    actual_close_time?: string;
    scheduled_close_time?: string;
    created_at?: string;
    modified_at?: string;
    comment_count?: number;
    vote_score?: number;
    // The question object varies by type
    question?: MetaculusRawBinaryQuestion | MetaculusRawNumericQuestion;
    // Group of questions
    group_of_questions?: MetaculusRawGroupOfQuestions;
    [key: string]: unknown;
}

export interface MetaculusRawBinaryQuestion {
    type: 'binary';
    community_prediction?: MetaculusCommunityPrediction;
    resolution?: number | null;
    range_min?: number;
    range_max?: number;
    [key: string]: unknown;
}

export interface MetaculusRawNumericQuestion {
    type: 'numeric' | 'date' | 'multiple_choice';
    community_prediction?: MetaculusCommunityPrediction;
    resolution?: number | null;
    range_min?: number;
    range_max?: number;
    [key: string]: unknown;
}

export interface MetaculusCommunityPrediction {
    full?: MetaculusPredictionData;
    recent?: MetaculusPredictionData;
    recency_weighted?: MetaculusPredictionData;
    [key: string]: unknown;
}

export interface MetaculusPredictionData {
    q1?: number;
    median?: number;
    q3?: number;
    mean?: number;
    yes?: number; // for binary questions
    no?: number;  // for binary questions
    [key: string]: unknown;
}

export interface MetaculusRawGroupOfQuestions {
    id: number;
    title: string;
    sub_questions: MetaculusRawSubQuestion[];
    [key: string]: unknown;
}

export interface MetaculusRawSubQuestion {
    id: number;
    title: string;
    question?: MetaculusRawBinaryQuestion | MetaculusRawNumericQuestion;
    resolution?: number | null;
    created_at?: string;
    scheduled_close_time?: string;
    actual_close_time?: string;
    [key: string]: unknown;
}

export interface MetaculusRawPaginatedResponse {
    count: number;
    next: string | null;
    previous: string | null;
    results: MetaculusRawPost[];
}

// ----------------------------------------------------------------------------
// Fetcher
// ----------------------------------------------------------------------------

export class MetaculusFetcher implements IExchangeFetcher<MetaculusRawPost, MetaculusRawPost> {
    private readonly ctx: FetcherContext;

    constructor(ctx: FetcherContext) {
        this.ctx = ctx;
    }

    async fetchRawMarkets(params?: MarketFilterParams): Promise<MetaculusRawPost[]> {
        try {
            const queryParams: Record<string, any> = {};
            queryParams.limit = Math.min(params?.limit || 100, 100);
            queryParams.offset = params?.offset || 0;

            if (params?.query) {
                queryParams.search = params.query;
            }

            // status mapping
            if (params?.status) {
                if (params.status === 'active' || params.status === 'open') {
                    queryParams.status = 'open';
                } else if (params.status === 'closed' || params.status === 'resolved') {
                    queryParams.status = 'closed';
                }
                // 'all' → no status filter
            }

            // No question_type filter — include both binary questions and
            // group-of-questions so expandGroupQuestions can expand sub-questions

            const response = await this.ctx.http.get<MetaculusRawPaginatedResponse>(
                `${BASE_URL}/posts/`,
                {
                    params: queryParams,
                    headers: this.ctx.getHeaders(),
                },
            );

            const posts = response.data?.results || [];
            return this.expandGroupQuestions(posts);
        } catch (error: any) {
            throw metaculusErrorMapper.mapError(error);
        }
    }

    async fetchRawEvents(params: EventFetchParams): Promise<MetaculusRawPost[]> {
        try {
            const queryParams: Record<string, any> = {};
            queryParams.limit = Math.min(params.limit || 100, 100);
            queryParams.offset = params.offset || 0;

            if (params.query) {
                queryParams.search = params.query;
            }

            // Events correspond to all public posts (groups + binary)
            const response = await this.ctx.http.get<MetaculusRawPaginatedResponse>(
                `${BASE_URL}/posts/`,
                {
                    params: queryParams,
                    headers: this.ctx.getHeaders(),
                },
            );

            return response.data?.results || [];
        } catch (error: any) {
            throw metaculusErrorMapper.mapError(error);
        }
    }

    // Expand group-of-questions into individual posts for market-level access
    private expandGroupQuestions(posts: MetaculusRawPost[]): MetaculusRawPost[] {
        const results: MetaculusRawPost[] = [];
        for (const post of posts) {
            if (post.group_of_questions && post.group_of_questions.sub_questions?.length > 0) {
                // Each sub-question becomes its own market entry
                for (const sub of post.group_of_questions.sub_questions) {
                    results.push({
                        id: sub.id,
                        title: sub.title || post.title,
                        url_slug: post.url_slug,
                        published_at: post.published_at,
                        resolved: sub.resolution !== null && sub.resolution !== undefined,
                        resolution: sub.resolution,
                        close_time: sub.scheduled_close_time || post.close_time,
                        scheduled_close_time: sub.scheduled_close_time || post.scheduled_close_time,
                        question: sub.question,
                        group_of_questions: undefined, // sub-questions don't nest
                        // Preserve parent context
                        _parentTitle: post.title,
                        _parentId: post.id,
                    } as MetaculusRawPost);
                }
            } else if (post.question) {
                // Binary/numeric question — use as-is
                results.push(post);
            }
        }
        return results;
    }
}