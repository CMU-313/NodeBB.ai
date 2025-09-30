# NodeBB.ai Copilot Instructions

## Architecture Overview

NodeBB is a modern forum platform built on Node.js with a modular, plugin-driven architecture.

### Core Components
- **Entry Point**: `app.js` → `src/start.js` - handles startup modes (setup, upgrade, normal operation)
- **Web Server**: `src/webserver.js` - Express.js app with middleware, routing, and SSL support
- **Database Layer**: `src/database/` - abstracted DB interface supporting Redis, MongoDB, PostgreSQL
- **Socket.IO**: `src/socket.io/` - real-time communication with clustering support via Redis adapter
- **Plugin System**: `src/plugins/` - extensible hook system for themes and functionality

### Key Directories
- `src/controllers/` - HTTP request handlers (admin, categories, posts, users, etc.)
- `src/routes/` - Express route definitions
- `src/middleware/` - authentication, rate limiting, CSRF protection
- `src/api/` - RESTful API endpoints
- `src/socket.io/` - WebSocket event handlers organized by namespace
- `src/meta/` - configuration, themes, CSS/JS building, templates

## Development Patterns

### Database Abstraction
```javascript
const db = require('./database'); // Auto-detects redis/mongo/postgres from config
await db.setObject('key', {field: 'value'});
await db.getObjectFields('key', ['field1', 'field2']);
```

### Plugin Hook System
```javascript
// Fire hooks to allow plugin extensions
const results = await plugins.hooks.fire('filter:flags.validateFilters', { filters });
// Use plugins.hooks.fire() for filtering data, plugins.hooks.fireSync() for actions
```

### Controller Pattern
Controllers return rendered templates or redirect. Use `helpers.notAllowed(req, res)` for 403s.
```javascript
res.render('template-name', {
    title: '[[pages:title-key]]',
    breadcrumbs: helpers.buildBreadcrumbs([...]),
    // Template data
});
```

### Configuration Management
- Main config: `config.json` loaded via `nconf`
- Meta configs: `src/meta/configs.js` for runtime settings
- Use `nconf.get('key')` for static config, `meta.config` for dynamic settings

## Development Workflow

### Build System
- `npm start` - starts via `loader.js` (handles clustering)
- `./nodebb build` - webpack build for client-side assets
- `./nodebb dev` - development mode with watching
- Tests: `npm test` (Mocha with NYC coverage)

### Plugin Development
- Plugins in `node_modules/nodebb-plugin-*` or local `plugins/`
- Plugin structure: `plugin.json` manifest + `library.js` with hook handlers
- Install: `./nodebb install <plugin-name>`
- Activate: `./nodebb activate <plugin-name>`

### Theme Development
- Themes extend base templates in `src/views/`
- Use Benchpress templating engine (similar to Handlebars)
- SCSS compilation via `src/meta/css.js`
- Theme manifest: `theme.json`

## Common Patterns

### Async Error Handling
Most functions are async and throw errors rather than using callbacks:
```javascript
try {
    const result = await someAsyncOperation();
} catch (err) {
    winston.error(err.stack);
    throw err;
}
```

### Privilege Checking
```javascript
const isAllowed = await privileges.categories.can('moderate', cid, req.uid);
const moderatedCids = await user.getModeratedCids(req.uid);
```

### Real-time Updates
```javascript
// Server-side socket emission
require('./socket.io').server.to('uid_' + uid).emit('event:notification');
// Client receives via socket listeners
```

### Database Operations
- Use `utils.promiseParallel()` for concurrent operations
- Parse integers: `db.parseIntFields(data, ['uid', 'cid'], requestedFields)`
- Batch operations: `src/batch.js` for processing large datasets

## Critical Files for AI Understanding

- `src/start.js` - Application lifecycle and initialization
- `src/controllers/index.js` - Route-to-controller mapping
- `src/plugins/hooks.js` - Plugin hook execution engine
- `src/privileges/index.js` - Permission system
- `src/socket.io/index.js` - WebSocket connection handling
- `src/meta/configs.js` - Runtime configuration management
- `test/` - Comprehensive test suite showing usage patterns

## Testing Strategy
- Integration tests in `test/` mirror `src/` structure
- Use `test/mocks/` for database and request mocking
- Run specific tests: `npx mocha test/categories.js`
- Coverage reports in `coverage/` directory