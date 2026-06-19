// core/src/exchanges/metaculus/api.ts
// Metaculus API spec — covers endpoints needed for market data operations.
// Based on the public Metaculus OpenAPI spec.
// See core/specs/metaculus/Metaculus.yaml for the full spec.

export const metaculusApiSpec = {
    openapi: '3.0.0',
    info: {
        title: 'Metaculus API',
        version: '2.0.0',
        description: 'Metaculus is a forecasting platform. Authentication: Token-based via Authorization header.',
    },
    servers: [{ url: 'https://www.metaculus.com/api' }],
    paths: {
        '/posts/': {
            get: {
                operationId: 'GetPosts',
                summary: 'List posts',
                parameters: [
                    { name: 'limit', in: 'query', schema: { type: 'integer', default: 100 } },
                    { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 } },
                    { name: 'search', in: 'query', schema: { type: 'string' } },
                    { name: 'statuses', in: 'query', schema: { type: 'string' } },
                    { name: 'question_type', in: 'query', schema: { type: 'string' } },
                    { name: 'order_by', in: 'query', schema: { type: 'string' } },
                    { name: 'topic', in: 'query', schema: { type: 'integer' } },
                    { name: 'forecast_type', in: 'query', schema: { type: 'string' } },
                ],
                responses: {
                    '200': { description: 'Paginated list of posts' },
                },
            },
        },
        '/questions/{id}/predict/': {
            post: {
                operationId: 'PredictQuestion',
                summary: 'Submit a probability forecast',
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    prediction: { type: 'number', description: '0-1 exclusive probability for binary; CDF array for continuous' },
                                },
                                required: ['prediction'],
                            },
                        },
                    },
                },
                security: [{ TokenAuth: [] }],
                responses: {
                    '200': { description: 'Prediction submitted' },
                },
            },
        },
        '/questions/{id}/predict/delete/': {
            post: {
                operationId: 'DeletePrediction',
                summary: 'Withdraw a forecast',
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
                security: [{ TokenAuth: [] }],
                responses: {
                    '200': { description: 'Prediction withdrawn' },
                },
            },
        },
    },
    components: {
        securitySchemes: {
            TokenAuth: {
                type: 'apiKey',
                in: 'header',
                name: 'Authorization',
                description: 'Format: Token <your_token>',
            },
        },
    },
};
