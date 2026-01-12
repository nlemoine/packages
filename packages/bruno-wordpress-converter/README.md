# WordPress REST API to Bruno Converter

Convert any WordPress REST API to a [Bruno](https://www.usebruno.com/) collection with beautiful interactive CLI or direct command-line usage.

## Compatibility

| Package Version | Bruno Version | Format |
|-----------------|---------------|--------|
| 1.x | Bruno 2.x / 3.x | `.bru` (Bru Lang) |
| **2.x** | **Bruno 3.x** | **`.yml` (OpenCollection)** |

Version 2.x generates the **OpenCollection YAML format** introduced in Bruno 3.

## Features

- Dynamic discovery of all endpoints (core, plugins, custom post types)
- Organization by namespace and resource type
- Beautiful interactive CLI with prompts
- Authentication ready (Basic Auth, Application Passwords)
- Optional schema fetching for faster conversions

## Installation

### Local Installation

```bash
pnpm add @n5s/bruno-wordpress-converter
```

### Global Installation

```bash
pnpm add -g @n5s/bruno-wordpress-converter
```

After global installation, the `wp-to-bruno` command is available anywhere:

```bash
wp-to-bruno https://example.com/wp-json/
```

## Usage

### Interactive Mode (Recommended)

```bash
# Local
node src/cli.js

# Global
wp-to-bruno
```

The CLI will prompt you for:
- WordPress API URL
- Collection name (optional, defaults to "{site name} REST API")
- Output directory
- Namespace filtering (optional)
- Schema fetching preference

### Command Line Mode

```bash
# Local
node src/cli.js https://example.com/wp-json/ -o ./my-api -n "My API"

# Global
wp-to-bruno https://example.com/wp-json/ -o ./my-api -n "My API"
```

### CLI Options

| Option | Alias | Description |
|--------|-------|-------------|
| `--output <dir>` | `-o` | Output directory |
| `--name <name>` | `-n` | Collection name (defaults to "{site name} REST API") |
| `--namespaces <list>` | | Comma-separated namespaces (e.g., "wp/v2,wc/v3") |
| `--no-schemas` | | Skip detailed schema fetching (faster) |
| `--username <username>` | `-u` | WordPress username for authentication |
| `--password <password>` | `-p` | WordPress application password |
| `--insecure` | `-k` | Allow insecure SSL connections |
| `--help` | `-h` | Show help |

### Examples

```bash
# Interactive mode
wp-to-bruno

# Quick conversion with defaults
wp-to-bruno https://example.com/wp-json/

# Full CLI mode
wp-to-bruno https://example.com/wp-json/ -o ./my-api -n "My API"

# Filter specific namespaces
wp-to-bruno https://example.com/wp-json/ --namespaces "wp/v2"

# Fast conversion without schemas
wp-to-bruno https://example.com/wp-json/ --no-schemas

# With authentication (for private/restricted endpoints)
wp-to-bruno https://example.com/wp-json/ -u admin -p "xxxx xxxx xxxx xxxx xxxx xxxx"

# Full example with all options
wp-to-bruno https://example.com/wp-json/ \
  -o ./my-api \
  -n "My Private API" \
  -u admin \
  -p "xxxx xxxx xxxx xxxx xxxx xxxx" \
  --namespaces "wp/v2,custom/v1"
```

## How It Works

1. Fetches the API index from `/wp-json/` to discover all routes
2. Optionally fetches detailed schemas via `OPTIONS` requests
3. Converts WordPress schema to Bruno OpenCollection YAML format
4. Organizes endpoints by namespace and resource type
5. Generates `.yml` files with environment variables

## Output Structure

```
bruno-collection/
├── opencollection.yml         # Collection configuration
├── environments/
│   └── default.yml            # baseUrl, username, password
├── wp-v2/
│   ├── folder.yml
│   ├── posts/
│   │   ├── folder.yml
│   │   ├── list-posts.yml
│   │   ├── create-posts.yml
│   │   ├── get-posts-by-id.yml
│   │   └── ...
│   ├── pages/
│   └── users/
└── [other-namespaces]/
```

Each endpoint includes:
- Request details (method, URL, headers)
- Query/path parameters with descriptions
- Request body examples for POST/PUT/PATCH

## Authentication

### During Conversion

For private or restricted endpoints, you can provide authentication credentials during the conversion process:

**Interactive Mode:**
The CLI will prompt you if you need authentication for private endpoints.

**Command Line Mode:**
```bash
wp-to-bruno https://example.com/wp-json/ -u admin -p "xxxx xxxx xxxx xxxx"
```

### Using the Generated Collection

After conversion, configure authentication in `environments/default.yml`:

```yaml
name: Default
variables:
  - name: baseUrl
    value: https://example.com/wp-json
  - name: username
    value: your-username
  - name: password
    value: your-application-password
```

### WordPress Application Passwords

Application Passwords (available since WordPress 5.6) are the recommended way to authenticate:

1. **Create an Application Password:**
   - Go to WordPress Admin → Users → Profile
   - Scroll to "Application Passwords" section
   - Enter a name (e.g., "Bruno API Client")
   - Click "Add New Application Password"
   - **Copy the generated password immediately** (it's only shown once)

2. **Use the Password:**
   - The password will have spaces (e.g., `xxxx xxxx xxxx xxxx`)
   - Spaces are automatically removed by the tool
   - You can use it with or without spaces

3. **Security Benefits:**
   - Works only for API requests (not site login)
   - Can be revoked anytime without changing your account password
   - Create separate passwords for different applications
   - Works with 2FA-protected accounts

**Note:** Application Passwords require HTTPS. For local development with self-signed certificates, use the `--insecure` flag.

## Troubleshooting

**CORS Errors**: Use a CORS plugin or run on the server

**Authentication Required**: Temporarily disable auth or manually download schema

**SSL Certificate Errors**: Use `--insecure` flag for local development with self-signed certificates

## License

MIT
