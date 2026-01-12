import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import wordpressToBruno from '../src/wordpress/wordpress-to-bruno.js';

// Mock node-fetch
vi.mock('node-fetch', () => ({
    default: vi.fn(),
}));

// Get the mocked fetch
import fetch from 'node-fetch';

// Sample WordPress API response
const createMockApiResponse = (routes = {}) => ({
    name: 'Test WordPress Site',
    description: 'A test site',
    url: 'https://example.com',
    home: 'https://example.com',
    namespaces: ['wp/v2'],
    routes: {
        '/wp/v2': {
            namespace: 'wp/v2',
            methods: ['GET'],
            endpoints: [{ methods: ['GET'], args: {} }],
        },
        ...routes,
    },
});

const createMockResponse = (data, ok = true) => ({
    ok,
    statusText: ok ? 'OK' : 'Not Found',
    json: () => Promise.resolve(data),
});

describe('wordpressToBruno', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Suppress console output during tests
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should throw error when API response has no routes', async () => {
        fetch.mockResolvedValueOnce(createMockResponse({ name: 'Test' }));

        await expect(
            wordpressToBruno('https://example.com/wp-json/'),
        ).rejects.toThrow(
            'Invalid WordPress REST API response - no routes found',
        );
    });

    it('should throw error when fetch fails', async () => {
        fetch.mockRejectedValueOnce(new Error('Network error'));

        await expect(
            wordpressToBruno('https://example.com/wp-json/'),
        ).rejects.toThrow('Error fetching WordPress schema: Network error');
    });

    it('should throw error when response is not ok', async () => {
        fetch.mockResolvedValueOnce(createMockResponse({}, false));

        await expect(
            wordpressToBruno('https://example.com/wp-json/'),
        ).rejects.toThrow('Failed to fetch WordPress API index');
    });

    it('should create a valid OpenCollection structure', async () => {
        const mockRoutes = {
            '/wp/v2/posts': {
                namespace: 'wp/v2',
                methods: ['GET', 'POST'],
                endpoints: [
                    {
                        methods: ['GET'],
                        args: {
                            page: { type: 'integer', default: 1 },
                            per_page: { type: 'integer', default: 10 },
                        },
                    },
                    {
                        methods: ['POST'],
                        args: {
                            title: { type: 'string', required: true },
                            content: { type: 'string' },
                        },
                    },
                ],
                schema: {
                    properties: {
                        id: { type: 'integer', readonly: true },
                        title: { type: 'object' },
                        content: { type: 'object' },
                    },
                },
            },
        };

        // Mock main API fetch
        fetch.mockResolvedValueOnce(
            createMockResponse(createMockApiResponse(mockRoutes)),
        );

        // Mock OPTIONS request for schema (returns null for simplicity)
        fetch.mockResolvedValue(createMockResponse(null, false));

        const result = await wordpressToBruno('https://example.com/wp-json/', {
            collectionName: 'Test Collection',
            fetchSchemas: false,
        });

        // Check OpenCollection structure
        expect(result).toHaveProperty('collection');
        expect(result.collection.opencollection).toBe('1.0.0');
        expect(result.collection.info.name).toBe('Test Collection');
        expect(result.collection.bundled).toBe(false);
        expect(result).toHaveProperty('items');
        expect(result).toHaveProperty('environments');
        expect(Array.isArray(result.items)).toBe(true);
    });

    it('should include default environment with baseUrl variable', async () => {
        const mockRoutes = {
            '/wp/v2/posts': {
                namespace: 'wp/v2',
                methods: ['GET'],
                endpoints: [{ methods: ['GET'], args: {} }],
            },
        };

        fetch.mockResolvedValueOnce(
            createMockResponse(createMockApiResponse(mockRoutes)),
        );

        const result = await wordpressToBruno('https://example.com/wp-json/', {
            fetchSchemas: false,
        });

        expect(result.environments).toHaveLength(1);
        expect(result.environments[0].name).toBe('Default');

        const baseUrlVar = result.environments[0].variables.find(
            (v) => v.name === 'baseUrl',
        );
        expect(baseUrlVar).toBeDefined();
        expect(baseUrlVar.value).toBe('https://example.com/wp-json');
    });

    it('should organize requests into namespace and resource folders', async () => {
        const mockRoutes = {
            '/wp/v2/posts': {
                namespace: 'wp/v2',
                methods: ['GET'],
                endpoints: [{ methods: ['GET'], args: {} }],
            },
            '/wp/v2/pages': {
                namespace: 'wp/v2',
                methods: ['GET'],
                endpoints: [{ methods: ['GET'], args: {} }],
            },
        };

        fetch.mockResolvedValueOnce(
            createMockResponse(createMockApiResponse(mockRoutes)),
        );

        const result = await wordpressToBruno('https://example.com/wp-json/', {
            fetchSchemas: false,
        });

        // Should have namespace folder
        const wpV2Folder = result.items.find((item) => item.slug === 'wp-v2');
        expect(wpV2Folder).toBeDefined();
        expect(wpV2Folder.type).toBe('folder');

        // Should have resource folders inside
        const postsFolder = wpV2Folder.items.find(
            (item) => item.slug === 'posts',
        );
        const pagesFolder = wpV2Folder.items.find(
            (item) => item.slug === 'pages',
        );
        expect(postsFolder).toBeDefined();
        expect(pagesFolder).toBeDefined();
    });

    it('should skip OPTIONS and HEAD methods', async () => {
        const mockRoutes = {
            '/wp/v2/posts': {
                namespace: 'wp/v2',
                methods: ['GET', 'POST', 'OPTIONS', 'HEAD'],
                endpoints: [
                    { methods: ['GET', 'OPTIONS', 'HEAD'], args: {} },
                    { methods: ['POST'], args: {} },
                ],
            },
        };

        fetch.mockResolvedValueOnce(
            createMockResponse(createMockApiResponse(mockRoutes)),
        );

        const result = await wordpressToBruno('https://example.com/wp-json/', {
            fetchSchemas: false,
        });

        const wpV2Folder = result.items.find((item) => item.slug === 'wp-v2');
        const postsFolder = wpV2Folder.items.find(
            (item) => item.slug === 'posts',
        );

        // Should only have GET and POST, not OPTIONS or HEAD
        const methods = postsFolder.items.map(
            (item) => item.content.http.method,
        );
        expect(methods).toContain('GET');
        expect(methods).toContain('POST');
        expect(methods).not.toContain('OPTIONS');
        expect(methods).not.toContain('HEAD');
    });

    it('should filter routes by namespace when includeNamespaces is specified', async () => {
        const mockRoutes = {
            '/wp/v2/posts': {
                namespace: 'wp/v2',
                methods: ['GET'],
                endpoints: [{ methods: ['GET'], args: {} }],
            },
            '/custom/v1/items': {
                namespace: 'custom/v1',
                methods: ['GET'],
                endpoints: [{ methods: ['GET'], args: {} }],
            },
        };

        fetch.mockResolvedValueOnce(
            createMockResponse(createMockApiResponse(mockRoutes)),
        );

        const result = await wordpressToBruno('https://example.com/wp-json/', {
            fetchSchemas: false,
            includeNamespaces: ['wp/v2'],
        });

        // Should only have wp-v2 namespace folder
        const folderSlugs = result.items.map((item) => item.slug);
        expect(folderSlugs).toContain('wp-v2');
        expect(folderSlugs).not.toContain('custom-v1');
    });

    it('should exclude routes specified in excludeRoutes', async () => {
        const mockRoutes = {
            '/wp/v2/posts': {
                namespace: 'wp/v2',
                methods: ['GET'],
                endpoints: [{ methods: ['GET'], args: {} }],
            },
            '/wp/v2/pages': {
                namespace: 'wp/v2',
                methods: ['GET'],
                endpoints: [{ methods: ['GET'], args: {} }],
            },
        };

        fetch.mockResolvedValueOnce(
            createMockResponse(createMockApiResponse(mockRoutes)),
        );

        const result = await wordpressToBruno('https://example.com/wp-json/', {
            fetchSchemas: false,
            excludeRoutes: ['/wp/v2/pages'],
        });

        const wpV2Folder = result.items.find((item) => item.slug === 'wp-v2');
        const resourceSlugs = wpV2Folder.items.map((item) => item.slug);

        expect(resourceSlugs).toContain('posts');
        expect(resourceSlugs).not.toContain('pages');
    });

    it('should convert path parameters to Bruno format', async () => {
        const mockRoutes = {
            '/wp/v2/posts/(?P<id>\\d+)': {
                namespace: 'wp/v2',
                methods: ['GET'],
                endpoints: [
                    {
                        methods: ['GET'],
                        args: {
                            id: { type: 'integer', required: true },
                        },
                    },
                ],
            },
        };

        fetch.mockResolvedValueOnce(
            createMockResponse(createMockApiResponse(mockRoutes)),
        );

        const result = await wordpressToBruno('https://example.com/wp-json/', {
            fetchSchemas: false,
        });

        const wpV2Folder = result.items.find((item) => item.slug === 'wp-v2');
        const postsFolder = wpV2Folder.items.find(
            (item) => item.slug === 'posts',
        );
        const getRequest = postsFolder.items.find(
            (item) => item.content.http.method === 'GET',
        );

        // URL should use :id format
        expect(getRequest.content.http.url).toContain(':id');
        expect(getRequest.content.http.url).not.toContain('(?P<');

        // Should have path parameter
        const pathParam = getRequest.content.http.params.find(
            (p) => p.type === 'path' && p.name === 'id',
        );
        expect(pathParam).toBeDefined();
    });

    it('should add Content-Type header for POST/PUT/PATCH requests', async () => {
        const mockRoutes = {
            '/wp/v2/posts': {
                namespace: 'wp/v2',
                methods: ['POST'],
                endpoints: [
                    {
                        methods: ['POST'],
                        args: { title: { type: 'string' } },
                    },
                ],
            },
        };

        fetch.mockResolvedValueOnce(
            createMockResponse(createMockApiResponse(mockRoutes)),
        );

        const result = await wordpressToBruno('https://example.com/wp-json/', {
            fetchSchemas: false,
        });

        const wpV2Folder = result.items.find((item) => item.slug === 'wp-v2');
        const postsFolder = wpV2Folder.items.find(
            (item) => item.slug === 'posts',
        );
        const postRequest = postsFolder.items.find(
            (item) => item.content.http.method === 'POST',
        );

        const contentTypeHeader = postRequest.content.http.headers.find(
            (h) => h.name === 'Content-Type',
        );
        expect(contentTypeHeader).toBeDefined();
        expect(contentTypeHeader.value).toBe('application/json');
    });

    it('should generate request body for POST requests', async () => {
        const mockRoutes = {
            '/wp/v2/posts': {
                namespace: 'wp/v2',
                methods: ['POST'],
                endpoints: [
                    {
                        methods: ['POST'],
                        args: {
                            title: { type: 'string', required: true },
                            status: {
                                type: 'string',
                                enum: ['publish', 'draft'],
                            },
                        },
                    },
                ],
            },
        };

        fetch.mockResolvedValueOnce(
            createMockResponse(createMockApiResponse(mockRoutes)),
        );

        const result = await wordpressToBruno('https://example.com/wp-json/', {
            fetchSchemas: false,
        });

        const wpV2Folder = result.items.find((item) => item.slug === 'wp-v2');
        const postsFolder = wpV2Folder.items.find(
            (item) => item.slug === 'posts',
        );
        const postRequest = postsFolder.items.find(
            (item) => item.content.http.method === 'POST',
        );

        expect(postRequest.content.http.body.type).toBe('json');
        expect(postRequest.content.http.body.data).toBeDefined();

        const bodyJson = JSON.parse(postRequest.content.http.body.data);
        expect(bodyJson).toHaveProperty('title');
        expect(bodyJson).toHaveProperty('status');
    });

    it('should normalize trailing slash in URL', async () => {
        const mockRoutes = {
            '/wp/v2/posts': {
                namespace: 'wp/v2',
                methods: ['GET'],
                endpoints: [{ methods: ['GET'], args: {} }],
            },
        };

        fetch.mockResolvedValueOnce(
            createMockResponse(createMockApiResponse(mockRoutes)),
        );

        const result = await wordpressToBruno('https://example.com/wp-json', {
            fetchSchemas: false,
        });

        const baseUrlVar = result.environments[0].variables.find(
            (v) => v.name === 'baseUrl',
        );
        expect(baseUrlVar.value).toBe('https://example.com/wp-json');
    });

    it('should create requests with slugified names', async () => {
        const mockRoutes = {
            '/wp/v2/posts': {
                namespace: 'wp/v2',
                methods: ['GET'],
                endpoints: [{ methods: ['GET'], args: {} }],
            },
        };

        fetch.mockResolvedValueOnce(
            createMockResponse(createMockApiResponse(mockRoutes)),
        );

        const result = await wordpressToBruno('https://example.com/wp-json/', {
            fetchSchemas: false,
        });

        const wpV2Folder = result.items.find((item) => item.slug === 'wp-v2');
        const postsFolder = wpV2Folder.items.find(
            (item) => item.slug === 'posts',
        );
        const request = postsFolder.items[0];

        // Slug should be lowercase with hyphens
        expect(request.slug).toMatch(/^[a-z0-9-]+$/);
        expect(request.type).toBe('request');
    });

    it('should include folder content with proper structure', async () => {
        const mockRoutes = {
            '/wp/v2/posts': {
                namespace: 'wp/v2',
                methods: ['GET'],
                endpoints: [{ methods: ['GET'], args: {} }],
            },
        };

        fetch.mockResolvedValueOnce(
            createMockResponse(createMockApiResponse(mockRoutes)),
        );

        const result = await wordpressToBruno('https://example.com/wp-json/', {
            fetchSchemas: false,
        });

        const wpV2Folder = result.items.find((item) => item.slug === 'wp-v2');

        // Folder should have content property with folder.yml structure
        expect(wpV2Folder.content).toBeDefined();
        expect(wpV2Folder.content.info.type).toBe('folder');
        expect(wpV2Folder.content.request.auth).toBe('inherit');
    });

    it('should include request settings', async () => {
        const mockRoutes = {
            '/wp/v2/posts': {
                namespace: 'wp/v2',
                methods: ['GET'],
                endpoints: [{ methods: ['GET'], args: {} }],
            },
        };

        fetch.mockResolvedValueOnce(
            createMockResponse(createMockApiResponse(mockRoutes)),
        );

        const result = await wordpressToBruno('https://example.com/wp-json/', {
            fetchSchemas: false,
        });

        const wpV2Folder = result.items.find((item) => item.slug === 'wp-v2');
        const postsFolder = wpV2Folder.items.find(
            (item) => item.slug === 'posts',
        );
        const request = postsFolder.items[0];

        // Request should have settings
        expect(request.content.settings).toBeDefined();
        expect(request.content.settings.encodeUrl).toBe(true);
        expect(request.content.settings.followRedirects).toBe(true);
    });

    it('should default collection name to "{site name} REST API" when not provided', async () => {
        const mockRoutes = {
            '/wp/v2/posts': {
                namespace: 'wp/v2',
                methods: ['GET'],
                endpoints: [{ methods: ['GET'], args: {} }],
            },
        };

        fetch.mockResolvedValueOnce(
            createMockResponse(createMockApiResponse(mockRoutes)),
        );

        const result = await wordpressToBruno('https://example.com/wp-json/', {
            fetchSchemas: false,
            // collectionName not provided
        });

        // Should use site name from API response
        expect(result.collection.info.name).toBe(
            'Test WordPress Site REST API',
        );
    });

    it('should use provided collectionName when specified', async () => {
        const mockRoutes = {
            '/wp/v2/posts': {
                namespace: 'wp/v2',
                methods: ['GET'],
                endpoints: [{ methods: ['GET'], args: {} }],
            },
        };

        fetch.mockResolvedValueOnce(
            createMockResponse(createMockApiResponse(mockRoutes)),
        );

        const result = await wordpressToBruno('https://example.com/wp-json/', {
            fetchSchemas: false,
            collectionName: 'My Custom API',
        });

        expect(result.collection.info.name).toBe('My Custom API');
    });

    describe('regression tests', () => {
        it('should generate unique names for routes with different path params (name collision bug)', async () => {
            // Bug: /settings (POST) and /settings/(?P<slug>) (POST) both generated "Create settings"
            // causing file overwrites when slugified to create-settings.yml
            const mockRoutes = {
                '/custom/v1/settings': {
                    namespace: 'custom/v1',
                    methods: ['POST'],
                    endpoints: [
                        {
                            methods: ['POST'],
                            args: {
                                option1: { type: 'string' },
                                option2: { type: 'boolean' },
                            },
                        },
                    ],
                },
                '/custom/v1/settings/(?P<slug>[a-z\\-]+)': {
                    namespace: 'custom/v1',
                    methods: ['POST'],
                    endpoints: [
                        {
                            methods: ['POST'],
                            args: {
                                slug: { type: 'string', required: true },
                            },
                        },
                    ],
                },
            };

            fetch.mockResolvedValueOnce(
                createMockResponse(createMockApiResponse(mockRoutes)),
            );

            const result = await wordpressToBruno(
                'https://example.com/wp-json/',
                {
                    fetchSchemas: false,
                },
            );

            const customFolder = result.items.find(
                (item) => item.slug === 'custom-v1',
            );
            const settingsFolder = customFolder.items.find(
                (item) => item.slug === 'settings',
            );
            const postRequests = settingsFolder.items.filter(
                (item) => item.content.http.method === 'POST',
            );

            // Should have 2 POST requests with different names
            expect(postRequests).toHaveLength(2);

            const names = postRequests.map((r) => r.name);
            const slugs = postRequests.map((r) => r.slug);

            // Names and slugs should be unique
            expect(new Set(names).size).toBe(2);
            expect(new Set(slugs).size).toBe(2);

            // One should have "by slug" suffix
            expect(names.some((n) => n.includes('by slug'))).toBe(true);
        });

        it('should only include schema-defined params, not hardcoded common params', async () => {
            // Bug: Hardcoded params (page, per_page, search, orderby, order, _embed)
            // were added to all GET requests without id param, even when not in schema
            const mockRoutes = {
                '/custom/v1/config': {
                    namespace: 'custom/v1',
                    methods: ['GET'],
                    endpoints: [
                        {
                            methods: ['GET'],
                            args: {
                                // Only has 'format' param, not pagination params
                                format: {
                                    type: 'string',
                                    enum: ['json', 'xml'],
                                },
                            },
                        },
                    ],
                },
            };

            fetch.mockResolvedValueOnce(
                createMockResponse(createMockApiResponse(mockRoutes)),
            );

            const result = await wordpressToBruno(
                'https://example.com/wp-json/',
                {
                    fetchSchemas: false,
                },
            );

            const customFolder = result.items.find(
                (item) => item.slug === 'custom-v1',
            );
            const configFolder = customFolder.items.find(
                (item) => item.slug === 'config',
            );
            const getRequest = configFolder.items.find(
                (item) => item.content.http.method === 'GET',
            );

            const paramNames =
                getRequest.content.http.params?.map((p) => p.name) || [];

            // Should only have 'format' from schema
            expect(paramNames).toContain('format');

            // Should NOT have hardcoded params that weren't in schema
            expect(paramNames).not.toContain('page');
            expect(paramNames).not.toContain('per_page');
            expect(paramNames).not.toContain('search');
            expect(paramNames).not.toContain('orderby');
            expect(paramNames).not.toContain('order');
            expect(paramNames).not.toContain('_embed');
        });

        it('should include pagination params when they ARE defined in schema', async () => {
            // Ensure we didn't break legitimate schema-defined params
            const mockRoutes = {
                '/wp/v2/posts': {
                    namespace: 'wp/v2',
                    methods: ['GET'],
                    endpoints: [
                        {
                            methods: ['GET'],
                            args: {
                                page: {
                                    type: 'integer',
                                    default: 1,
                                    description: 'Current page',
                                },
                                per_page: {
                                    type: 'integer',
                                    default: 10,
                                    description: 'Items per page',
                                },
                                search: {
                                    type: 'string',
                                    description: 'Search term',
                                },
                            },
                        },
                    ],
                },
            };

            fetch.mockResolvedValueOnce(
                createMockResponse(createMockApiResponse(mockRoutes)),
            );

            const result = await wordpressToBruno(
                'https://example.com/wp-json/',
                {
                    fetchSchemas: false,
                },
            );

            const wpV2Folder = result.items.find(
                (item) => item.slug === 'wp-v2',
            );
            const postsFolder = wpV2Folder.items.find(
                (item) => item.slug === 'posts',
            );
            const getRequest = postsFolder.items.find(
                (item) => item.content.http.method === 'GET',
            );

            const paramNames =
                getRequest.content.http.params?.map((p) => p.name) || [];

            // These should be present because they're in the schema
            expect(paramNames).toContain('page');
            expect(paramNames).toContain('per_page');
            expect(paramNames).toContain('search');
        });
    });
});
