import { describe, expect, it } from 'vitest';
import {
    cleanWordPressSchemaProperties,
    extractPathParameters,
    extractValidationConstraints,
    getParameterLocation,
    isCollectionEndpoint,
    isParameterRequired,
    normalizeEnum,
    normalizeWordPressType,
} from '../src/utils/wordpress-utils.js';

describe('normalizeWordPressType', () => {
    it('should normalize date format types to string', () => {
        expect(normalizeWordPressType('date')).toBe('string');
        expect(normalizeWordPressType('date-time')).toBe('string');
    });

    it('should normalize email and url types to string', () => {
        expect(normalizeWordPressType('email')).toBe('string');
        expect(normalizeWordPressType('uri')).toBe('string');
        expect(normalizeWordPressType('url')).toBe('string');
    });

    it('should normalize network types to string', () => {
        expect(normalizeWordPressType('hostname')).toBe('string');
        expect(normalizeWordPressType('ipv4')).toBe('string');
        expect(normalizeWordPressType('ipv6')).toBe('string');
    });

    it('should normalize mixed and bool types', () => {
        expect(normalizeWordPressType('mixed')).toBe('string');
        expect(normalizeWordPressType('bool')).toBe('boolean');
    });

    it('should pass through standard JSON Schema types unchanged', () => {
        expect(normalizeWordPressType('string')).toBe('string');
        expect(normalizeWordPressType('integer')).toBe('integer');
        expect(normalizeWordPressType('number')).toBe('number');
        expect(normalizeWordPressType('boolean')).toBe('boolean');
        expect(normalizeWordPressType('array')).toBe('array');
        expect(normalizeWordPressType('object')).toBe('object');
    });

    it('should handle arrays of types', () => {
        expect(normalizeWordPressType(['date', 'string'])).toEqual([
            'string',
            'string',
        ]);
        expect(normalizeWordPressType(['bool', 'integer'])).toEqual([
            'boolean',
            'integer',
        ]);
    });
});

describe('normalizeEnum', () => {
    it('should remove duplicate values', () => {
        expect(normalizeEnum(['a', 'b', 'a', 'c'])).toEqual(['a', 'b', 'c']);
    });

    it('should return non-array values unchanged', () => {
        expect(normalizeEnum('not-an-array')).toBe('not-an-array');
        expect(normalizeEnum(null)).toBe(null);
        expect(normalizeEnum(undefined)).toBe(undefined);
    });

    it('should handle empty arrays', () => {
        expect(normalizeEnum([])).toEqual([]);
    });

    it('should preserve order of first occurrences', () => {
        expect(normalizeEnum(['z', 'a', 'z', 'b'])).toEqual(['z', 'a', 'b']);
    });
});

describe('isCollectionEndpoint', () => {
    it('should identify core WordPress collection endpoints', () => {
        expect(isCollectionEndpoint('/wp/v2/posts')).toBe(true);
        expect(isCollectionEndpoint('/wp/v2/pages')).toBe(true);
        expect(isCollectionEndpoint('/wp/v2/media')).toBe(true);
        expect(isCollectionEndpoint('/wp/v2/users')).toBe(true);
        expect(isCollectionEndpoint('/wp/v2/comments')).toBe(true);
    });

    it('should identify nested collection endpoints with path params', () => {
        expect(
            isCollectionEndpoint('/wp/v2/posts/(?P<parent>\\d+)/revisions'),
        ).toBe(true);
        expect(
            isCollectionEndpoint('/wp/v2/posts/(?P<id>\\d+)/autosaves'),
        ).toBe(true);
    });

    it('should return false for single resource endpoints', () => {
        expect(isCollectionEndpoint('/wp/v2/posts/(?P<id>\\d+)')).toBe(false);
        expect(isCollectionEndpoint('/wp/v2/settings')).toBe(false);
    });

    it('should return false for unknown endpoints', () => {
        expect(isCollectionEndpoint('/custom/v1/items')).toBe(false);
    });
});

describe('cleanWordPressSchemaProperties', () => {
    it('should remove context and readonly keys', () => {
        const props = {
            id: { type: 'integer' },
            context: ['view', 'edit'],
            readonly: true,
            title: { type: 'string' },
        };
        const cleaned = cleanWordPressSchemaProperties(props);
        expect(cleaned).toEqual({
            id: { type: 'integer' },
            title: { type: 'string' },
        });
    });

    it('should recursively clean nested objects', () => {
        const props = {
            meta: {
                type: 'object',
                context: ['view'],
                properties: {
                    key: { type: 'string', readonly: true },
                },
            },
        };
        const cleaned = cleanWordPressSchemaProperties(props);
        expect(cleaned.meta.context).toBeUndefined();
        expect(cleaned.meta.properties.key.readonly).toBeUndefined();
    });

    it('should handle null and non-object inputs', () => {
        expect(cleanWordPressSchemaProperties(null)).toBe(null);
        expect(cleanWordPressSchemaProperties(undefined)).toBe(undefined);
        expect(cleanWordPressSchemaProperties('string')).toBe('string');
    });

    it('should clean arrays of objects', () => {
        const props = {
            items: [{ context: ['view'], type: 'string' }, { readonly: true }],
        };
        const cleaned = cleanWordPressSchemaProperties(props);
        expect(cleaned.items[0].context).toBeUndefined();
        expect(cleaned.items[1].readonly).toBeUndefined();
    });
});

describe('extractValidationConstraints', () => {
    it('should extract length constraints', () => {
        const args = { minLength: 1, maxLength: 100 };
        expect(extractValidationConstraints(args)).toEqual({
            minLength: 1,
            maxLength: 100,
        });
    });

    it('should extract numeric constraints', () => {
        const args = { minimum: 0, maximum: 100, multipleOf: 5 };
        expect(extractValidationConstraints(args)).toEqual({
            minimum: 0,
            maximum: 100,
            multipleOf: 5,
        });
    });

    it('should extract array constraints', () => {
        const args = { minItems: 1, maxItems: 10, uniqueItems: true };
        expect(extractValidationConstraints(args)).toEqual({
            minItems: 1,
            maxItems: 10,
            uniqueItems: true,
        });
    });

    it('should extract and normalize enum', () => {
        const args = { enum: ['a', 'b', 'a'] };
        expect(extractValidationConstraints(args)).toEqual({
            enum: ['a', 'b'],
        });
    });

    it('should extract format and pattern', () => {
        const args = { format: 'email', pattern: '^[a-z]+$' };
        expect(extractValidationConstraints(args)).toEqual({
            format: 'email',
            pattern: '^[a-z]+$',
        });
    });

    it('should ignore unsupported constraints', () => {
        const args = { unsupported: true, description: 'test', minLength: 5 };
        expect(extractValidationConstraints(args)).toEqual({ minLength: 5 });
    });
});

describe('getParameterLocation', () => {
    it('should return path for path parameters', () => {
        expect(getParameterLocation('GET', 'id', ['id'])).toBe('path');
        expect(getParameterLocation('POST', 'id', ['id', 'parent'])).toBe(
            'path',
        );
    });

    it('should return query for GET requests', () => {
        expect(getParameterLocation('GET', 'page', [])).toBe('query');
        expect(getParameterLocation('get', 'search', [])).toBe('query');
    });

    it('should return body for non-GET methods', () => {
        expect(getParameterLocation('POST', 'title', [])).toBe('body');
        expect(getParameterLocation('PUT', 'content', [])).toBe('body');
        expect(getParameterLocation('PATCH', 'status', [])).toBe('body');
        expect(getParameterLocation('DELETE', 'force', [])).toBe('body');
    });

    it('should prioritize path over method-based location', () => {
        expect(getParameterLocation('POST', 'id', ['id'])).toBe('path');
    });
});

describe('extractPathParameters', () => {
    it('should extract named groups from WordPress route patterns', () => {
        expect(extractPathParameters('/wp/v2/posts/(?P<id>\\d+)')).toEqual([
            'id',
        ]);
        expect(
            extractPathParameters('/wp/v2/posts/(?P<parent>\\d+)/revisions'),
        ).toEqual(['parent']);
    });

    it('should extract multiple path parameters', () => {
        expect(
            extractPathParameters(
                '/wp/v2/posts/(?P<parent>\\d+)/revisions/(?P<id>\\d+)',
            ),
        ).toEqual(['parent', 'id']);
    });

    it('should return empty array for routes without path params', () => {
        expect(extractPathParameters('/wp/v2/posts')).toEqual([]);
        expect(extractPathParameters('/wp/v2/settings')).toEqual([]);
    });

    it('should handle various regex patterns', () => {
        expect(
            extractPathParameters('/wp/v2/users/(?P<user_id>[\\d]+)/passwords'),
        ).toEqual(['user_id']);
        expect(
            extractPathParameters('/wp/v2/templates/(?P<id>[\\/\\w-]+)'),
        ).toEqual(['id']);
    });
});

describe('isParameterRequired', () => {
    it('should return true for path parameters', () => {
        expect(isParameterRequired({}, true)).toBe(true);
        expect(isParameterRequired({ required: false }, true)).toBe(true);
    });

    it('should respect explicit required field', () => {
        expect(isParameterRequired({ required: true }, false)).toBe(true);
        expect(isParameterRequired({ required: false }, false)).toBe(false);
    });

    it('should default to false for non-path params without required field', () => {
        expect(isParameterRequired({}, false)).toBe(false);
        expect(isParameterRequired({ description: 'test' }, false)).toBe(false);
    });
});
