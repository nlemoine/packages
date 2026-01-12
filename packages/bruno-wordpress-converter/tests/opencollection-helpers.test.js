import yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';
import {
    createCollectionConfig,
    createEnvironment,
    createFolder,
    createHttpRequest,
    slugify,
    toYaml,
} from '../src/utils/opencollection-helpers.js';

describe('toYaml', () => {
    it('should serialize object to YAML string', () => {
        const data = { name: 'Test', value: 123 };
        const result = toYaml(data);

        expect(typeof result).toBe('string');
        expect(result).toContain('name: Test');
        expect(result).toContain('value: 123');
    });

    it('should produce valid YAML that can be parsed back', () => {
        const data = {
            info: { name: 'Test Collection', type: 'http' },
            http: { method: 'GET', url: 'https://example.com' },
        };
        const yamlString = toYaml(data);
        const parsed = yaml.load(yamlString);

        expect(parsed).toEqual(data);
    });

    it('should handle nested objects and arrays', () => {
        const data = {
            items: [
                { name: 'item1', enabled: true },
                { name: 'item2', enabled: false },
            ],
        };
        const result = toYaml(data);
        const parsed = yaml.load(result);

        expect(parsed).toEqual(data);
    });

    it('should preserve key order (sortKeys: false)', () => {
        const data = { z: 1, a: 2, m: 3 };
        const result = toYaml(data);
        const lines = result.trim().split('\n');

        expect(lines[0]).toContain('z:');
        expect(lines[1]).toContain('a:');
        expect(lines[2]).toContain('m:');
    });
});

describe('createCollectionConfig', () => {
    it('should create valid collection config', () => {
        const config = createCollectionConfig('My API');

        expect(config.opencollection).toBe('1.0.0');
        expect(config.info.name).toBe('My API');
        expect(config.bundled).toBe(false);
    });

    it('should include default request settings', () => {
        const config = createCollectionConfig('Test');

        expect(config.request.auth).toBe('inherit');
        expect(config.request.headers).toEqual([
            { name: 'Accept', value: 'application/json' },
        ]);
    });

    it('should include extensions with ignore patterns', () => {
        const config = createCollectionConfig('Test');

        expect(config.extensions.ignore).toContain('node_modules');
        expect(config.extensions.ignore).toContain('.git');
    });
});

describe('createEnvironment', () => {
    it('should create environment with name and baseUrl', () => {
        const env = createEnvironment('Production', 'https://api.example.com');

        expect(env.name).toBe('Production');
        expect(env.variables).toContainEqual({
            name: 'baseUrl',
            value: 'https://api.example.com',
        });
    });

    it('should include empty username and password variables', () => {
        const env = createEnvironment('Default', 'https://example.com');

        expect(env.variables).toContainEqual({ name: 'username', value: '' });
        expect(env.variables).toContainEqual({ name: 'password', value: '' });
    });

    it('should have exactly 3 variables', () => {
        const env = createEnvironment('Test', 'https://test.com');

        expect(env.variables).toHaveLength(3);
    });
});

describe('createFolder', () => {
    it('should create folder with name and sequence', () => {
        const folder = createFolder('posts', 1);

        expect(folder.info.name).toBe('posts');
        expect(folder.info.type).toBe('folder');
        expect(folder.info.seq).toBe(1);
    });

    it('should inherit auth by default', () => {
        const folder = createFolder('users', 2);

        expect(folder.request.auth).toBe('inherit');
    });
});

describe('createHttpRequest', () => {
    it('should create basic GET request', () => {
        const request = createHttpRequest(
            'List posts',
            1,
            'GET',
            '{{baseUrl}}/posts',
        );

        expect(request.info.name).toBe('List posts');
        expect(request.info.type).toBe('http');
        expect(request.info.seq).toBe(1);
        expect(request.http.method).toBe('GET');
        expect(request.http.url).toBe('{{baseUrl}}/posts');
        expect(request.http.auth).toBe('inherit');
    });

    it('should include default settings', () => {
        const request = createHttpRequest(
            'Test',
            1,
            'GET',
            'https://example.com',
        );

        expect(request.settings.encodeUrl).toBe(true);
        expect(request.settings.timeout).toBe(0);
        expect(request.settings.followRedirects).toBe(true);
        expect(request.settings.maxRedirects).toBe(5);
    });

    it('should uppercase method', () => {
        const request = createHttpRequest(
            'Test',
            1,
            'post',
            'https://example.com',
        );

        expect(request.http.method).toBe('POST');
    });

    it('should include params when provided', () => {
        const params = [
            { name: 'page', value: '1', type: 'query' },
            { name: 'id', value: '', type: 'path' },
        ];
        const request = createHttpRequest(
            'Test',
            1,
            'GET',
            'https://example.com',
            {
                params,
            },
        );

        expect(request.http.params).toEqual(params);
    });

    it('should not include params when empty', () => {
        const request = createHttpRequest(
            'Test',
            1,
            'GET',
            'https://example.com',
            {
                params: [],
            },
        );

        expect(request.http.params).toBeUndefined();
    });

    it('should include headers when provided', () => {
        const headers = [{ name: 'Content-Type', value: 'application/json' }];
        const request = createHttpRequest(
            'Test',
            1,
            'POST',
            'https://example.com',
            { headers },
        );

        expect(request.http.headers).toEqual(headers);
    });

    it('should not include headers when empty', () => {
        const request = createHttpRequest(
            'Test',
            1,
            'GET',
            'https://example.com',
            {
                headers: [],
            },
        );

        expect(request.http.headers).toBeUndefined();
    });

    it('should include body when provided', () => {
        const body = { type: 'json', data: '{"title": "Test"}' };
        const request = createHttpRequest(
            'Test',
            1,
            'POST',
            'https://example.com',
            { body },
        );

        expect(request.http.body).toEqual(body);
    });

    it('should not include body when not provided', () => {
        const request = createHttpRequest(
            'Test',
            1,
            'GET',
            'https://example.com',
        );

        expect(request.http.body).toBeUndefined();
    });
});

describe('slugify', () => {
    it('should convert to lowercase', () => {
        expect(slugify('Hello World')).toBe('hello-world');
    });

    it('should replace spaces with hyphens', () => {
        expect(slugify('List all posts')).toBe('list-all-posts');
    });

    it('should handle special characters', () => {
        expect(slugify('Get post by ID')).toBe('get-post-by-id');
        expect(slugify('wp/v2')).toBe('wp-v2');
    });

    it('should handle already slugified strings', () => {
        expect(slugify('list-posts')).toBe('list-posts');
    });
});
