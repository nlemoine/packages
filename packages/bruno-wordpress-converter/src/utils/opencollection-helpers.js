import slugify from '@sindresorhus/slugify';
import yaml from 'js-yaml';

/**
 * Serialize data to YAML with proper formatting (same options Bruno uses)
 * @param {Object} data - Data to serialize
 * @returns {string} YAML string
 */
export const toYaml = (data) =>
    yaml.dump(data, {
        indent: 2,
        lineWidth: -1,
        noRefs: true,
        sortKeys: false,
    });

/**
 * Generate opencollection.yml content
 * @param {string} name - Collection name
 * @returns {Object} OpenCollection config
 */
export const createCollectionConfig = (name) => ({
    opencollection: '1.0.0',
    info: { name },
    request: {
        auth: 'inherit',
        headers: [{ name: 'Accept', value: 'application/json' }],
    },
    bundled: false,
    extensions: { ignore: ['node_modules', '.git'] },
});

/**
 * Generate environment file content
 * @param {string} name - Environment name
 * @param {string} baseUrl - WordPress API base URL
 * @returns {Object} Environment config
 */
export const createEnvironment = (name, baseUrl) => ({
    name,
    variables: [
        { name: 'baseUrl', value: baseUrl },
        { name: 'username', value: '' },
        { name: 'password', value: '' },
    ],
});

/**
 * Generate folder.yml content
 * @param {string} name - Folder name
 * @param {number} seq - Sequence number
 * @returns {Object} Folder config
 */
export const createFolder = (name, seq) => ({
    info: { name, type: 'folder', seq },
    request: { auth: 'inherit' },
});

/**
 * Generate HTTP request file content
 * @param {string} name - Request name
 * @param {number} seq - Sequence number
 * @param {string} method - HTTP method
 * @param {string} url - Request URL
 * @param {Object} options - Additional options (params, body, headers)
 * @returns {Object} HTTP request config
 */
export const createHttpRequest = (name, seq, method, url, options = {}) => {
    const request = {
        info: { name, type: 'http', seq },
        http: {
            method: method.toUpperCase(),
            url,
            auth: 'inherit',
        },
        settings: {
            encodeUrl: true,
            timeout: 0,
            followRedirects: true,
            maxRedirects: 5,
        },
    };

    // Add optional fields only if they have content
    if (options.headers?.length) {
        request.http.headers = options.headers;
    }

    if (options.params?.length) {
        request.http.params = options.params;
    }

    if (options.body) {
        request.http.body = options.body;
    }

    return request;
};

export { slugify };
