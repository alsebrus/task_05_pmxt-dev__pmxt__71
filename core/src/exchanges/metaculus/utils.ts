// Metaculus API base URLs
export const BASE_URL = 'https://www.metaculus.com/api';
// Convert a raw timestamp to milliseconds.
// Metaculus uses Unix seconds in some fields and ISO date strings in others.
export function toMillis(ts: number | string | undefined | null): number {
    if (!ts) return 0;
    if (typeof ts === 'string') {
        // ISO 8601 date strings (e.g. "2029-12-31T23:59:59Z")
        // parseFloat would only extract the leading year digits giving ~1970
        if (/^\d{4}-\d{2}-\d{2}/.test(ts)) {
            const parsed = Date.parse(ts);
            return isNaN(parsed) ? 0 : parsed;
        }
        // Numeric string (Unix seconds or millis)
        const num = parseFloat(ts);
        if (isNaN(num)) return 0;
        // Metaculus timestamps are in seconds if under 10 billion
        return num < 10_000_000_000 ? num * 1000 : num;
    }
    // Already a number
    if (isNaN(ts)) return 0;
    return ts < 10_000_000_000 ? ts * 1000 : ts;
}

// Safely parse a numeric value
export function parseNum(value: string | number | undefined | null): number {
    if (value === undefined || value === null) return 0;
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return isNaN(num) ? 0 : num;
}