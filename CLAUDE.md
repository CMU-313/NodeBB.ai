# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

NodeBB is a Node.js-based forum platform that supports multiple database backends (MongoDB, PostgreSQL, or Redis). It uses WebSockets for real-time interactions and has a plugin-based architecture for extensibility.

**Key Technologies:**
- Node.js (>=20)
- Express.js for HTTP server
- Socket.IO for real-time communication
- Benchpress templating engine
- Webpack for asset bundling
- Multiple database support: MongoDB, PostgreSQL, Redis

## Common Commands

### Development
```bash
# Start NodeBB
npm start                    # Production mode
./nodebb start              # CLI start command
./nodebb dev                # Development mode with verbose logging

# Build assets
./nodebb build              # Build all assets (JS, CSS, templates, languages)
./nodebb build javascript   # Build only JavaScript
./nodebb build css          # Build only CSS
./nodebb build templates    # Build only templates
./nodebb build languages    # Build only language files

# Watch mode (auto-rebuild on changes)
grunt                       # Watch and rebuild on file changes
```

### Testing
```bash
# Run all tests
npm test

# Run specific test file
npx mocha test/topics.js

# Run with coverage
npm run coverage
```

### Linting
```bash
npm run lint                # Run ESLint
npm run lint -- --fix       # Auto-fix linting issues
```

### CLI Tools
```bash
./nodebb setup              # Run setup wizard
./nodebb upgrade            # Run upgrade scripts
./nodebb reset              # Reset plugins, themes, widgets, or settings
./nodebb activate <plugin>  # Activate a plugin
./nodebb plugins            # List all plugins
./nodebb events             # List all fired events
```

### Database Operations
The database type is configured in `config.json` and NodeBB will use the appropriate adapter (`src/database/mongo.js`, `src/database/postgres.js`, or `src/database/redis.js`).

## Architecture

### Application Entry Points

1. **`app.js`** - Main application entry point
   - Handles CLI argument parsing
   - Routes to setup, upgrade, or normal start
   - Delegates to `src/start.js` for normal operation

2. **`loader.js`** - Cluster mode process manager
   - Manages multiple worker processes
   - Handles process forking and restart
   - Used for production deployments with clustering

3. **`nodebb`** - CLI executable
   - Entry point for all CLI commands
   - Located at project root, calls `src/cli/index.js`

### Core Architecture

**Server Stack:**
```
loader.js (cluster manager)
  └─> app.js (application bootstrap)
      └─> src/start.js (initialization)
          ├─> src/database/index.js (DB initialization)
          ├─> src/meta/configs.js (configuration)
          ├─> src/webserver.js (Express app)
          └─> src/socket.io/index.js (WebSocket server)
```

**Request Flow:**
```
HTTP Request → Express Middleware → Routes → Controllers → API/Business Logic → Database
WebSocket → Socket.IO → Socket Handlers → Business Logic → Database
```

### Key Directories

- **`src/`** - Server-side code
  - `src/database/` - Database abstraction layer with adapters for mongo/postgres/redis
  - `src/api/` - RESTful API endpoints (modern write API)
  - `src/controllers/` - HTTP route controllers for page rendering
  - `src/socket.io/` - WebSocket event handlers
  - `src/routes/` - Express route definitions
  - `src/middleware/` - Express middleware (auth, rate limiting, etc.)
  - `src/plugins/` - Plugin system core
  - `src/meta/` - Meta/config management and build system
  - `src/cli/` - CLI command implementations
  - `src/posts/`, `src/topics/`, `src/categories/`, `src/user/`, `src/groups/` - Core domain models

- **`public/src/`** - Client-side JavaScript (pre-build)
  - `public/src/client/` - Page-specific client code
  - `public/src/modules/` - Reusable client modules
  - `public/src/admin/` - Admin control panel code

- **`build/`** - Built assets (generated, not in git)
  - Created by webpack build process

- **`test/`** - Test suite
  - Uses Mocha test framework
  - `test/mocks/` - Mock implementations for testing
  - Tests are organized by feature (topics.js, posts.js, user.js, etc.)

### Plugin System

NodeBB has a powerful hook-based plugin system:

- **Plugin Discovery**: Plugins follow the naming pattern `nodebb-plugin-*` or `nodebb-theme-*`
- **Plugin Loading**: `src/plugins/load.js` handles plugin initialization
- **Hook System**: `src/plugins/hooks.js` manages hook registration and firing
  - **Filter hooks**: Transform data (e.g., `filter:post.save`)
  - **Action hooks**: Side effects (e.g., `action:topic.delete`)
  - **Static hooks**: Return static data (e.g., `static:app.load`)

**Hook Registration Example:**
```javascript
// In a plugin
Hooks.register('plugin-id', {
    hook: 'filter:post.save',
    method: functionToCall,
    priority: 10  // Lower runs first
});
```

### Database Abstraction

The database layer (`src/database/index.js`) dynamically loads the appropriate adapter based on `config.json`:

- All database operations go through the abstraction layer
- Adapters implement a common interface for CRUD operations
- Session store can be configured separately (often Redis even with MongoDB/PostgreSQL primary)

### Build System

The build process (managed by `src/meta/build.js`) handles:
- **JavaScript**: Webpack bundles client and admin JS
- **CSS**: SCSS compilation and minification
- **Templates**: Benchpress template compilation
- **Languages**: i18n file processing
- **Static Assets**: Plugin static file linking

Build targets are modular - you can build individual components or everything.

### Testing

- **Framework**: Mocha with 25s timeout (configured in `.mocharc.yml`)
- **Mocks**: Database operations are mocked via `test/mocks/databasemock.js`
- **Test Helpers**: Common test utilities in `test/helpers.js`
- **Coverage**: nyc (Istanbul) for code coverage reporting

**Test Structure:**
```javascript
describe('Feature Name', () => {
    before(async () => {
        // Setup - runs once before all tests
    });

    it('should do something', async () => {
        // Individual test
    });
});
```

## Development Workflow

1. **Making Changes:**
   - Server code changes: Restart NodeBB (`./nodebb restart` or `Ctrl+C` and `npm start`)
   - Client code changes: Rebuild with `./nodebb build` or use `grunt` watch mode
   - Plugin changes: May require `./nodebb build` and restart

2. **Before Committing:**
   - Run linting: `npm run lint`
   - Run tests: `npm test`
   - Ensure build succeeds: `./nodebb build`

3. **Database Migrations:**
   - Upgrade scripts in `src/upgrades/` run automatically on version changes
   - Use `./nodebb upgrade` to run pending migrations

## Important Patterns

### Async/Await
Modern NodeBB code uses async/await throughout. Avoid callback-style code in new development.

### Error Handling
Use try/catch blocks and propagate errors with meaningful messages. The error handling middleware (`src/meta/errors.js`) provides consistent error responses.

### Privileges System
All privileged operations should check permissions via `src/privileges/`. Never trust client input for authorization.

### Configuration
Access configuration via `nconf.get('key')` (from `nconf` package). Config is loaded from `config.json` and can be overridden by environment variables.

### Logging
Use `winston` for all logging:
```javascript
const winston = require('winston');
winston.info('Info message');
winston.warn('Warning message');
winston.error('Error message');
winston.verbose('Verbose message');  // Only in dev/verbose mode
```
