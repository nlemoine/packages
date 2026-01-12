#!/usr/bin/env node

import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import {
    cancel,
    confirm,
    intro,
    isCancel,
    log,
    note,
    outro,
    spinner,
    text,
} from '@clack/prompts';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { toYaml } from './utils/opencollection-helpers.js';
import wordpressToBruno from './wordpress/wordpress-to-bruno.js';

// Parse CLI arguments
const argv = yargs(hideBin(process.argv))
    .usage('Usage: $0 [url] [options]')
    .command(
        '$0 [url]',
        'Convert WordPress REST API to Bruno collection',
        (yargs) => {
            yargs.positional('url', {
                describe: 'WordPress REST API URL',
                type: 'string',
            });
        },
    )
    .option('output', {
        alias: 'o',
        type: 'string',
        description: 'Output directory',
        default: null,
    })
    .option('name', {
        alias: 'n',
        type: 'string',
        description: 'Collection name',
        default: null,
    })
    .option('namespaces', {
        type: 'string',
        description:
            'Comma-separated namespaces to include (e.g., "wp/v2,custom/v1")',
    })
    .option('no-schemas', {
        type: 'boolean',
        description: 'Skip fetching detailed schemas (faster)',
        default: false,
    })
    .option('insecure', {
        alias: 'k',
        type: 'boolean',
        description:
            'Allow insecure SSL connections (ignore certificate errors)',
        default: false,
    })
    .option('username', {
        alias: 'u',
        type: 'string',
        description: 'WordPress username for authentication',
    })
    .option('password', {
        alias: 'p',
        type: 'string',
        description:
            'WordPress application password (spaces will be automatically removed)',
    })
    .help('h')
    .alias('h', 'help')
    .example('$0', 'Interactive mode (recommended)')
    .example(
        '$0 https://example.com/wp-json/',
        'Quick conversion with defaults',
    )
    .example(
        '$0 https://example.com/wp-json/ -o ./my-api -n "My API"',
        'Full CLI mode',
    )
    .example(
        '$0 https://example.com/wp-json/ --namespaces "wp/v2"',
        'Filter by namespace',
    )
    .example(
        '$0 https://example.com/wp-json/ -u admin -p "xxxx xxxx xxxx xxxx"',
        'With authentication',
    )
    .parseSync();

const main = async () => {
    // Handle insecure flag by setting NODE_TLS_REJECT_UNAUTHORIZED
    // This is needed because node-fetch with https-proxy-agent doesn't properly
    // pass rejectUnauthorized through the agent options
    if (argv.insecure) {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    }

    console.clear();

    intro('WordPress to Bruno Converter');

    // Get URL from args or prompt
    const urlArg = argv.url;
    let wpApiUrl = urlArg?.startsWith('http') ? urlArg : null;

    if (!wpApiUrl) {
        wpApiUrl = await text({
            message: 'Enter your WordPress REST API URL',
            placeholder: 'https://example.com/wp-json/',
            validate: (value) => {
                if (!value) return 'URL is required';
                if (
                    !value.startsWith('http://') &&
                    !value.startsWith('https://')
                ) {
                    return 'URL must start with http:// or https://';
                }
            },
        });

        if (isCancel(wpApiUrl)) {
            cancel('Operation cancelled');
            process.exit(0);
        }
    }

    // Get collection name from args or prompt
    let collectionName = argv.name;
    if (!collectionName && !urlArg?.startsWith('http')) {
        collectionName = await text({
            message:
                'Collection name (leave empty to use "{site name} REST API")',
            placeholder: 'My API Collection',
        });

        if (isCancel(collectionName)) {
            cancel('Operation cancelled');
            process.exit(0);
        }

        // Convert empty string to null for default behavior
        if (!collectionName?.trim()) {
            collectionName = null;
        }
    }

    // Get output directory from args or prompt
    let outputDir = argv.output;
    if (!outputDir) {
        outputDir = await text({
            message: 'Where should we save the collection?',
            placeholder: './bruno-collection',
            defaultValue: './bruno-collection',
        });

        if (isCancel(outputDir)) {
            cancel('Operation cancelled');
            process.exit(0);
        }
    }

    // Get namespaces from args or prompt
    let includeNamespaces = null;
    const hasUrlArg = urlArg?.startsWith('http');

    if (argv.namespaces) {
        includeNamespaces = argv.namespaces.split(',').map((ns) => ns.trim());
    } else if (!hasUrlArg) {
        // Only prompt if not in CLI mode
        const filterNamespaces = await confirm({
            message: 'Do you want to filter by specific namespaces?',
            initialValue: false,
        });

        if (isCancel(filterNamespaces)) {
            cancel('Operation cancelled');
            process.exit(0);
        }

        if (filterNamespaces) {
            const namespacesInput = await text({
                message: 'Enter namespaces (comma-separated)',
                placeholder: 'wp/v2,custom/v1',
                validate: (value) => {
                    if (!value) return 'Please enter at least one namespace';
                },
            });

            if (isCancel(namespacesInput)) {
                cancel('Operation cancelled');
                process.exit(0);
            }

            includeNamespaces = namespacesInput
                .split(',')
                .map((ns) => ns.trim());
        }
    }

    // Get schema fetching preference from args or prompt
    let fetchSchemas = !argv.noSchemas;

    // Only prompt if not in CLI mode and not specified
    if (!argv.noSchemas && !hasUrlArg) {
        fetchSchemas = await confirm({
            message: 'Fetch detailed schemas? (recommended, but slower)',
            initialValue: true,
        });

        if (isCancel(fetchSchemas)) {
            cancel('Operation cancelled');
            process.exit(0);
        }
    }

    // Get authentication from args or prompt
    let username = argv.username;
    let password = argv.password;

    if (!username && !hasUrlArg) {
        // Only prompt in interactive mode
        const useAuth = await confirm({
            message:
                'Do you need authentication? (for private/restricted endpoints)',
            initialValue: false,
        });

        if (isCancel(useAuth)) {
            cancel('Operation cancelled');
            process.exit(0);
        }

        if (useAuth) {
            username = await text({
                message: 'WordPress username',
                validate: (value) => {
                    if (!value)
                        return 'Username is required for authentication';
                },
            });

            if (isCancel(username)) {
                cancel('Operation cancelled');
                process.exit(0);
            }

            password = await text({
                message:
                    'Application password (spaces will be removed automatically)',
                validate: (value) => {
                    if (!value) return 'Application password is required';
                },
            });

            if (isCancel(password)) {
                cancel('Operation cancelled');
                process.exit(0);
            }
        }
    }

    // Show summary
    note(
        `URL: ${wpApiUrl}\nCollection: ${collectionName || '(auto: {site name} REST API)'}\nOutput: ${outputDir}\n${includeNamespaces ? `Namespaces: ${includeNamespaces.join(', ')}\n` : ''}Schemas: ${fetchSchemas ? 'Yes' : 'No'}\nAuthentication: ${username ? 'Yes' : 'No'}`,
        'Configuration',
    );

    try {
        // Clean output directory if it exists
        if (existsSync(outputDir)) {
            const s = spinner();
            s.start('Cleaning existing output directory');
            await setTimeout(100);
            rmSync(outputDir, { recursive: true, force: true });
            s.stop('Output directory cleaned');
        }

        // Create fresh output directory
        mkdirSync(outputDir, { recursive: true });

        // Convert WordPress API
        const s = spinner();
        s.start('Fetching WordPress API schema');

        const options = {
            collectionName,
            fetchSchemas,
            includeNamespaces,
            rejectUnauthorized: !argv.insecure,
            username,
            password,
        };

        const result = await wordpressToBruno(wpApiUrl, options);

        s.message('Writing Bruno collection files');

        // Write opencollection.yml
        writeFileSync(
            join(outputDir, 'opencollection.yml'),
            toYaml(result.collection),
        );

        // Create environments directory and write environment files
        const envDir = join(outputDir, 'environments');
        mkdirSync(envDir, { recursive: true });

        for (const env of result.environments) {
            const envFileName = env.name.toLowerCase().replace(/\s+/g, '-');
            writeFileSync(join(envDir, `${envFileName}.yml`), toYaml(env));
        }

        // Recursively write folders and requests
        const writeItems = (items, parentDir) => {
            for (const item of items) {
                if (item.type === 'folder') {
                    // Create folder directory
                    const folderPath = join(parentDir, item.slug);
                    mkdirSync(folderPath, { recursive: true });

                    // Write folder.yml
                    writeFileSync(
                        join(folderPath, 'folder.yml'),
                        toYaml(item.content),
                    );

                    // Write nested items
                    if (item.items?.length > 0) {
                        writeItems(item.items, folderPath);
                    }
                } else if (item.type === 'request') {
                    // Write request file
                    writeFileSync(
                        join(parentDir, `${item.slug}.yml`),
                        toYaml(item.content),
                    );
                }
            }
        };

        writeItems(result.items, outputDir);

        s.stop('Collection generated successfully');

        outro(`Bruno collection created at: ${outputDir}`);

        // Show next steps
        console.log('');
        note(
            '1. Open Bruno and import the collection\n2. Configure authentication in environments/default.yml\n3. Start testing your WordPress API!',
            'Next Steps',
        );
    } catch (error) {
        log.error(`Conversion failed: ${error.message}`);
        if (error.stack) {
            console.error(error.stack);
        }
        process.exit(1);
    }
};

main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
