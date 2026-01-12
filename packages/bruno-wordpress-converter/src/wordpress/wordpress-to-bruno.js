import https from 'node:https';
import { HttpsProxyAgent } from 'https-proxy-agent';
import fetch from 'node-fetch';
import {
    createCollectionConfig,
    createEnvironment,
    createFolder,
    createHttpRequest,
    slugify,
} from '../utils/opencollection-helpers.js';
import {
    extractPathParameters,
    extractValidationConstraints,
    getParameterLocation,
    isCollectionEndpoint,
    isParameterRequired,
    normalizeEnum,
    normalizeWordPressType,
} from '../utils/wordpress-utils.js';

/**
 * Create Basic Authentication header value
 * @param {string} username - WordPress username
 * @param {string} password - WordPress application password
 * @returns {string} Base64 encoded auth header value
 */
const createBasicAuthHeader = (username, password) => {
    const cleanPassword = password.replace(/\s+/g, '');
    const credentials = `${username}:${cleanPassword}`;
    return `Basic ${Buffer.from(credentials).toString('base64')}`;
};

/**
 * Get appropriate agent for fetch requests
 * @param {string} url - The URL being fetched
 * @param {boolean} rejectUnauthorized - Whether to reject unauthorized SSL certificates
 * @returns {Agent|undefined} HTTPS agent with proxy/SSL config
 */
const getAgent = (url, rejectUnauthorized = true) => {
    if (!url.startsWith('https:')) {
        return undefined;
    }

    const proxyUrl =
        process.env.HTTP_PROXY ||
        process.env.http_proxy ||
        process.env.HTTPS_PROXY ||
        process.env.https_proxy;

    if (proxyUrl) {
        return new HttpsProxyAgent(proxyUrl, { rejectUnauthorized });
    }

    return new https.Agent({ rejectUnauthorized });
};

/**
 * Fetch WordPress REST API schema from a given URL
 * @param {string} wpApiUrl - WordPress REST API base URL
 * @param {Object} options - Fetch options
 * @returns {Promise<Object>} WordPress REST API index response
 */
const fetchWordPressSchema = async (wpApiUrl, options = {}) => {
    const url = wpApiUrl.endsWith('/') ? wpApiUrl : `${wpApiUrl}/`;
    const {
        rejectUnauthorized = true,
        username,
        password,
        ...fetchOptions
    } = options;

    const headers = {};
    if (username && password) {
        headers.Authorization = createBasicAuthHeader(username, password);
    }

    try {
        const response = await fetch(url, {
            agent: getAgent(url, rejectUnauthorized),
            headers,
            ...fetchOptions,
        });

        if (!response.ok) {
            throw new Error(
                `Failed to fetch WordPress API index: ${response.statusText}`,
            );
        }
        return await response.json();
    } catch (error) {
        throw new Error(`Error fetching WordPress schema: ${error.message}`);
    }
};

/**
 * Fetch detailed schema for a specific route using OPTIONS request
 * @param {string} wpApiUrl - WordPress REST API base URL
 * @param {string} route - The route to fetch schema for
 * @param {Object} options - Options
 * @returns {Promise<Object>} Detailed route schema
 */
const fetchRouteSchema = async (wpApiUrl, route, options = {}) => {
    const { rejectUnauthorized = true, username, password } = options;
    const baseUrl = wpApiUrl.endsWith('/') ? wpApiUrl.slice(0, -1) : wpApiUrl;
    const url = `${baseUrl}${route}`;

    try {
        const headers = {};
        if (username && password) {
            headers.Authorization = createBasicAuthHeader(username, password);
        }

        const response = await fetch(url, {
            method: 'OPTIONS',
            agent: getAgent(url, rejectUnauthorized),
            headers,
        });

        if (!response.ok) {
            return null;
        }
        return await response.json();
    } catch {
        return null;
    }
};

/**
 * Generate example value based on WordPress schema property
 * @param {Object} property - Schema property definition
 * @param {string} name - Property name for contextual examples
 * @returns {*} Example value
 */
const generateExampleValue = (property, name) => {
    if (property.enum?.length > 0) {
        return property.enum[0];
    }

    if (property.default !== undefined) {
        return property.default;
    }

    const normalizedType = normalizeWordPressType(property.type || 'string');

    switch (normalizedType) {
        case 'integer':
            return 0;
        case 'number':
            return 0.0;
        case 'boolean':
            return false;
        case 'array':
            return [];
        case 'object':
            if (property.properties) {
                const obj = {};
                for (const [propName, prop] of Object.entries(
                    property.properties,
                )) {
                    obj[propName] = generateExampleValue(prop, propName);
                }
                return obj;
            }
            return {};
        default:
            if (name === 'status') return 'publish';
            if (name === 'title' || name === 'name') return 'Example Title';
            if (name === 'content') return 'Example content';
            if (name === 'excerpt') return 'Example excerpt';
            if (name === 'slug') return 'example-slug';
            if (name === 'password') return '';
            if (name === 'author') return 1;
            if (property.format === 'date-time')
                return new Date().toISOString();
            if (property.format === 'uri') return 'https://example.com';
            return '';
    }
};

/**
 * Generate request body from WordPress endpoint args and schema
 * @param {Object} args - WordPress endpoint arguments
 * @param {Object} schema - WordPress resource schema
 * @param {string} method - HTTP method
 * @param {Array} pathParams - List of path parameter names
 * @returns {Object|null} Body object for OpenCollection format
 */
const generateRequestBody = (args, schema, method, pathParams = []) => {
    const body = {};

    if (args) {
        for (const [argName, arg] of Object.entries(args)) {
            if (argName === 'context' || pathParams.includes(argName)) continue;
            if (arg.readonly === true) continue;

            const location = getParameterLocation(method, argName, pathParams);
            if (location === 'body') {
                const normalizedType = normalizeWordPressType(
                    arg.type || 'string',
                );
                const property = {
                    type: normalizedType,
                    default: arg.default,
                    enum: arg.enum ? normalizeEnum(arg.enum) : undefined,
                    format: arg.format,
                };
                body[argName] = generateExampleValue(property, argName);
            }
        }
    }

    if (schema?.properties) {
        const commonFields = [
            'title',
            'content',
            'excerpt',
            'status',
            'author',
            'slug',
            'password',
            'name',
            'description',
        ];
        for (const [name, property] of Object.entries(schema.properties)) {
            if (body[name] !== undefined || property.readonly === true)
                continue;
            if (commonFields.includes(name)) {
                body[name] = generateExampleValue(property, name);
            }
        }
    }

    if (Object.keys(body).length === 0) return null;

    return {
        type: 'json',
        data: JSON.stringify(body, null, 2),
    };
};

/**
 * Transform WordPress route and method to OpenCollection request
 * @param {string} route - WordPress route path
 * @param {string} method - HTTP method
 * @param {Object} endpoint - Endpoint configuration
 * @param {Object} schema - Resource schema
 * @param {number} seq - Sequence number
 * @returns {Object} OpenCollection request item
 */
const transformWordPressEndpoint = (route, method, endpoint, schema, seq) => {
    const methodUpper = method.toUpperCase();
    const args = endpoint.args || {};

    // Generate request name
    const resourceMatch = route.match(/\/(?:wp\/v2|[^/]+\/v\d+)\/(\w+)/);
    const resource = resourceMatch ? resourceMatch[1] : 'resource';
    const pathParams = extractPathParameters(route);
    const hasIdParam = pathParams.includes('id');
    const hasOtherPathParams =
        pathParams.filter((p) => p !== 'id' && p !== 'parent').length > 0;
    const isAutosave = route.includes('autosaves');
    const isRevision = route.includes('revisions');
    const isCollection = isCollectionEndpoint(route);

    // Build suffix for routes with non-id path params to avoid name collisions
    const pathParamSuffix = hasOtherPathParams
        ? ` by ${pathParams.filter((p) => p !== 'id' && p !== 'parent').join(' and ')}`
        : '';

    let name;
    switch (methodUpper) {
        case 'GET':
            if (isAutosave) {
                name =
                    hasIdParam && route.match(/autosaves\/\(\?P<id>/i)
                        ? `Get ${resource} autosave by ID`
                        : `List ${resource} autosaves`;
            } else if (isRevision) {
                name =
                    hasIdParam && route.match(/revisions\/\(\?P<id>/i)
                        ? `Get ${resource} revision by ID`
                        : `List ${resource} revisions`;
            } else if (hasIdParam) {
                name = `Get ${resource} by ID${pathParamSuffix}`;
            } else if (isCollection) {
                name = `List ${resource}${pathParamSuffix}`;
            } else {
                name = `Get ${resource}${pathParamSuffix}`;
            }
            break;
        case 'POST':
            name = isAutosave
                ? `Create ${resource} autosave`
                : isRevision
                  ? `Create ${resource} revision`
                  : `Create ${resource}${pathParamSuffix}`;
            break;
        case 'PUT':
        case 'PATCH':
            name = `Update ${resource}${pathParamSuffix}`;
            break;
        case 'DELETE':
            name = isAutosave
                ? `Delete ${resource} autosave`
                : isRevision
                  ? `Delete ${resource} revision`
                  : `Delete ${resource}${pathParamSuffix}`;
            break;
        default:
            name = `${methodUpper} ${route}`;
    }

    // Convert route pattern to URL format (?P<id>\d+) -> :id
    const urlPath = route.replace(/\(\?P<(\w+)>[^)]+\)/g, ':$1');

    // Build params array
    const params = [];

    for (const [argName, arg] of Object.entries(args)) {
        if (argName === 'context') continue;

        const location = getParameterLocation(methodUpper, argName, pathParams);

        if (location === 'path') {
            params.push({
                name: argName,
                value: '',
                type: 'path',
                ...(arg.description && { description: arg.description }),
            });
        } else if (location === 'query') {
            const defaultValue =
                arg.default !== undefined ? String(arg.default) : '';
            const isRequired = isParameterRequired(arg, false);
            const constraints = extractValidationConstraints(arg);

            let description = arg.description || '';
            if (constraints.enum) {
                description += description ? '. ' : '';
                description += `Allowed values: ${constraints.enum.join(', ')}`;
            }

            params.push({
                name: argName,
                value: defaultValue,
                type: 'query',
                ...(description && { description }),
                ...(!isRequired && { disabled: true }),
            });
        }
    }

    // Build headers for POST/PUT/PATCH
    const headers = [];
    if (['POST', 'PUT', 'PATCH'].includes(methodUpper)) {
        headers.push({ name: 'Content-Type', value: 'application/json' });
    }

    // Generate body for POST/PUT/PATCH
    const body = ['POST', 'PUT', 'PATCH'].includes(methodUpper)
        ? generateRequestBody(args, schema, methodUpper, pathParams)
        : null;

    return {
        type: 'request',
        name,
        slug: slugify(name),
        content: createHttpRequest(
            name,
            seq,
            methodUpper,
            `{{baseUrl}}${urlPath}`,
            {
                params: params.length > 0 ? params : undefined,
                headers: headers.length > 0 ? headers : undefined,
                body,
            },
        ),
    };
};

/**
 * Organize endpoints into nested folder structure
 * @param {Array} requests - Array of request items with route metadata
 * @returns {Array} Nested folder structure
 */
const organizeIntoFolders = (requests) => {
    const namespaceMap = new Map();

    for (const request of requests) {
        const { namespace, resource } = request._meta;

        if (!namespaceMap.has(namespace)) {
            namespaceMap.set(namespace, new Map());
        }

        const resourceMap = namespaceMap.get(namespace);
        if (!resourceMap.has(resource)) {
            resourceMap.set(resource, []);
        }

        // Remove internal metadata before storing
        const { _meta, ...cleanRequest } = request;
        resourceMap.get(resource).push(cleanRequest);
    }

    // Build folder structure
    const items = [];
    let namespaceSeq = 1;

    for (const [namespace, resourceMap] of namespaceMap) {
        const namespaceSlug = slugify(namespace);
        const resourceItems = [];
        let resourceSeq = 1;

        for (const [resource, resourceRequests] of resourceMap) {
            const resourceSlug = slugify(resource);

            // Update sequence numbers for requests
            const requests = resourceRequests.map((req, idx) => ({
                ...req,
                content: {
                    ...req.content,
                    info: { ...req.content.info, seq: idx + 1 },
                },
            }));

            resourceItems.push({
                type: 'folder',
                name: resource,
                slug: resourceSlug,
                content: createFolder(resource, resourceSeq),
                items: requests,
            });
            resourceSeq++;
        }

        items.push({
            type: 'folder',
            name: namespace,
            slug: namespaceSlug,
            content: createFolder(namespace, namespaceSeq),
            items: resourceItems,
        });
        namespaceSeq++;
    }

    return items;
};

/**
 * Main function to convert WordPress REST API to OpenCollection format
 * @param {string} wpApiUrl - WordPress REST API base URL
 * @param {Object} options - Conversion options
 * @returns {Promise<Object>} OpenCollection structured data
 */
const wordpressToBruno = async (wpApiUrl, options = {}) => {
    const {
        collectionName = null,
        includeNamespaces = null,
        excludeRoutes = [],
        fetchSchemas = true,
        rejectUnauthorized = true,
        username,
        password,
    } = options;

    const baseUrl = wpApiUrl.endsWith('/') ? wpApiUrl.slice(0, -1) : wpApiUrl;

    // Fetch the main API index
    const apiIndex = await fetchWordPressSchema(wpApiUrl, {
        rejectUnauthorized,
        username,
        password,
    });

    if (!apiIndex.routes) {
        throw new Error(
            'Invalid WordPress REST API response - no routes found',
        );
    }

    // Derive collection name from API response if not provided
    const resolvedCollectionName =
        collectionName || `${apiIndex.name || 'WordPress'} REST API`;

    const requests = [];
    const processedRoutes = new Set();
    let seq = 1;

    // Process each route
    for (const [route, routeData] of Object.entries(apiIndex.routes)) {
        if (processedRoutes.has(route) || excludeRoutes.includes(route)) {
            continue;
        }

        // Filter by namespace
        const namespaceMatch =
            routeData.namespace || route.match(/^\/([^/]+\/v\d+)/)?.[1];
        if (
            includeNamespaces &&
            (!namespaceMatch || !includeNamespaces.includes(namespaceMatch))
        ) {
            continue;
        }

        // Extract resource from route
        const resourceMatch = route.match(/\/(?:[^/]+\/v\d+)\/([^/:(?]+)/);
        const resource = resourceMatch ? resourceMatch[1] : 'misc';
        const namespace = namespaceMatch || 'default';

        // Fetch detailed schema if requested
        let detailedSchema = null;
        if (fetchSchemas) {
            detailedSchema = await fetchRouteSchema(baseUrl, route, {
                rejectUnauthorized,
                username,
                password,
            });
        }

        const schema = detailedSchema?.schema || routeData.schema || null;
        const endpoints =
            detailedSchema?.endpoints || routeData.endpoints || [];

        // Process each endpoint
        for (const endpoint of endpoints) {
            const methods = endpoint.methods || [];

            for (const method of methods) {
                if (['OPTIONS', 'HEAD'].includes(method)) continue;

                try {
                    const request = transformWordPressEndpoint(
                        route,
                        method,
                        endpoint,
                        schema,
                        seq,
                    );
                    request._meta = { namespace, resource };
                    requests.push(request);
                    seq++;
                } catch {
                    // Skip problematic endpoints silently
                }
            }
        }

        processedRoutes.add(route);
    }

    // Organize into folders
    const items = organizeIntoFolders(requests);

    // Build result
    return {
        collection: createCollectionConfig(resolvedCollectionName),
        environments: [createEnvironment('Default', baseUrl)],
        items,
    };
};

export default wordpressToBruno;
