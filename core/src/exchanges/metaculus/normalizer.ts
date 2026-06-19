import {
    UnifiedMarket,
    UnifiedEvent,
    MarketOutcome,
} from '../../types';
import { IExchangeNormalizer } from '../interfaces';
import { addBinaryOutcomes } from '../../utils/market-utils';
import { toMillis, parseNum } from './utils';
import { MetaculusRawPost } from './fetcher';

// ----------------------------------------------------------------------------
// Metaculus Normalizer — maps raw posts to unified types
// ----------------------------------------------------------------------------

export class MetaculusNormalizer implements IExchangeNormalizer<MetaculusRawPost, MetaculusRawPost> {

    // -- Markets ---------------------------------------------------------------

    normalizeMarket(raw: MetaculusRawPost): UnifiedMarket | null {
        if (!raw) return null;

        const question = raw.question;
        if (!question) return null;

        // Binary question → Yes/No outcomes with community probability
        if (question.type === 'binary') {
            return this.normalizeBinaryMarket(raw);
        }

        // Numeric/date/multiple_choice questions — normalize as generic market
        return this.normalizeNumericMarket(raw);
    }

    // -- Events (groups of questions map to events) --------------------------

    normalizeEvent(raw: MetaculusRawPost): UnifiedEvent | null {
        if (!raw) return null;

        const markets: UnifiedMarket[] = [];

        if (raw.group_of_questions && raw.group_of_questions.sub_questions?.length > 0) {
            // Group-of-questions: each sub-question becomes a market
            for (const sub of raw.group_of_questions.sub_questions) {
                const subMarket = this.normalizeSubQuestion(sub, raw);
                if (subMarket) markets.push(subMarket);
            }
        } else if (raw.question) {
            // Single question
            const market = this.normalizeMarket(raw);
            if (market) markets.push(market);
        }

        return {
            id: String(raw.id),
            title: raw.title || raw.short_title || '',
            description: '',
            slug: raw.url_slug || String(raw.id),
            markets,
            volume24h: 0,
            url: `https://www.metaculus.com/questions/${raw.url_slug || raw.id}`,
        };
    }

    // -- Private helpers ------------------------------------------------------

    private normalizeBinaryMarket(raw: MetaculusRawPost): UnifiedMarket | null {
        const question = raw.question as any;
        if (!question) return null;

        const marketId = String(raw.id);

        // Community prediction probability
        let yesProb = 0.5;
        let noProb = 0.5;

        if (question.community_prediction) {
            const cp = question.community_prediction;
            // Binary questions store probability under "yes" or "mean"
            if (cp.full) {
                yesProb = typeof cp.full.yes === 'number' ? cp.full.yes : (typeof cp.full.mean === 'number' ? cp.full.mean : 0.5);
                noProb = 1 - yesProb;
            } else if (cp.recency_weighted) {
                yesProb = typeof cp.recency_weighted.yes === 'number' ? cp.recency_weighted.yes : (typeof cp.recency_weighted.mean === 'number' ? cp.recency_weighted.mean : 0.5);
                noProb = 1 - yesProb;
            }
        }

        const yesOutcome: MarketOutcome = {
            outcomeId: `${marketId}-yes`,
            marketId,
            label: 'Yes',
            price: yesProb,
        };

        const noOutcome: MarketOutcome = {
            outcomeId: `${marketId}-no`,
            marketId,
            label: 'No',
            price: noProb,
        };

        const closeTime = raw.scheduled_close_time || raw.close_time;

        const market: UnifiedMarket = {
            marketId,
            title: raw.title || raw.short_title || '',
            description: '',
            outcomes: [yesOutcome, noOutcome],
            resolutionDate: closeTime ? new Date(toMillis(closeTime)) : new Date(0),
            volume24h: 0,
            liquidity: 0,
            url: `https://www.metaculus.com/questions/${raw.url_slug || raw.id}`,
        };

        addBinaryOutcomes(market);
        return market;
    }

    private normalizeNumericMarket(raw: MetaculusRawPost): UnifiedMarket | null {
        const question = raw.question as any;
        if (!question) return null;

        const marketId = String(raw.id);

        // For numeric/date questions, use median as the "probability-like" value
        let medianProb = 0.5;
        if (question.community_prediction?.full) {
            medianProb = typeof question.community_prediction.full.median === 'number'
                ? question.community_prediction.full.median
                : 0.5;
        }

        const upOutcome: MarketOutcome = {
            outcomeId: `${marketId}-up`,
            marketId,
            label: 'Up',
            price: medianProb,
        };

        const downOutcome: MarketOutcome = {
            outcomeId: `${marketId}-down`,
            marketId,
            label: 'Down',
            price: 1 - medianProb,
        };

        const closeTime = raw.scheduled_close_time || raw.close_time;

        const market: UnifiedMarket = {
            marketId,
            title: raw.title || raw.short_title || '',
            description: '',
            outcomes: [upOutcome, downOutcome],
            resolutionDate: closeTime ? new Date(toMillis(closeTime)) : new Date(0),
            volume24h: 0,
            liquidity: 0,
            url: `https://www.metaculus.com/questions/${raw.url_slug || raw.id}`,
        };

        addBinaryOutcomes(market);
        return market;
    }

    private normalizeSubQuestion(
        sub: any,
        parent: MetaculusRawPost,
    ): UnifiedMarket | null {
        const marketId = String(sub.id);
        const parentId = String(parent.id);

        // Get probability from sub-question's question object
        let yesProb = 0.5;
        let noProb = 0.5;

        if (sub.question?.community_prediction) {
            const cp = sub.question.community_prediction;
            if (cp.full) {
                yesProb = typeof cp.full.yes === 'number' ? cp.full.yes : (typeof cp.full.mean === 'number' ? cp.full.mean : 0.5);
                noProb = 1 - yesProb;
            }
        }

        const yesOutcome: MarketOutcome = {
            outcomeId: `${marketId}-yes`,
            marketId,
            label: 'Yes',
            price: yesProb,
        };

        const noOutcome: MarketOutcome = {
            outcomeId: `${marketId}-no`,
            marketId,
            label: 'No',
            price: noProb,
        };

        const closeTime = sub.scheduled_close_time || parent.scheduled_close_time || parent.close_time;

        const market: UnifiedMarket = {
            marketId,
            eventId: parentId,
            title: sub.title || parent.title || '',
            description: '',
            outcomes: [yesOutcome, noOutcome],
            resolutionDate: closeTime ? new Date(toMillis(closeTime)) : new Date(0),
            volume24h: 0,
            liquidity: 0,
            url: `https://www.metaculus.com/questions/${parent.url_slug || parent.id}`,
        };

        addBinaryOutcomes(market);
        return market;
    }
}