# Cloudflare R2 Uploader

Cloudflare R2 Uploader is a TypeScript-based API service built with Hono that allows uploading blog posts (markdown files) and header images to Cloudflare R2 storage with metadata stored in Cloudflare D1 database.

Always reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.

## Working Effectively

Bootstrap, build, and test the repository:

- Install pnpm globally: `npm install -g pnpm`
- Install dependencies: `pnpm install` -- takes 3-4 seconds
- Setup database:
  - `npx wrangler d1 execute blog-db --local --file=./migrations/init.sql` -- takes 1 second
  - `npx wrangler d1 execute blog-db --local --file=./migrations/add-r2-key.sql` -- takes 1 second
  - `npx wrangler d1 execute blog-db --local --file=./migrations/add-header.sql` -- takes 1 second
- Generate TypeScript types: `pnpm cf-typegen` -- takes 1 second
- Start development server: `pnpm dev` -- starts immediately, server runs on http://localhost:8787

NEVER CANCEL the development server - it runs indefinitely until manually stopped.

## Validation

After making changes, always validate functionality manually:

- Test basic endpoints:
  - `curl http://localhost:8787/` should return "ragebaited"
  - `curl http://localhost:8787/health` should return "OK"
  - `curl http://localhost:8787/list` should return `{"posts":[]}`

- ALWAYS test complete user scenarios after making changes:
  1. Create a test markdown file and header image
  2. Upload using POST to /create-blog with form data (file, header, token, title, description, category, tags)
  3. Verify post appears in /list endpoint
  4. Retrieve individual post via /post/:id endpoint
  5. Delete post via DELETE /post/:id endpoint

- Example complete validation scenario:
```bash
# Create test files
echo "# Test Post\nContent here" > /tmp/test.md
echo -e "\x89PNG\r\n\x1a\n..." > /tmp/test.png

# Upload post
curl -X POST http://localhost:8787/create-blog \
  -F "file=@/tmp/test.md" \
  -F "header=@/tmp/test.png" \
  -F "token=secret" \
  -F "title=Test Post" \
  -F "description=Test description" \
  -F "category=test"

# Test retrieval and deletion with returned postId
```

- Validate deployment builds correctly: `npx wrangler deploy --minify --dry-run` -- takes 1 second

## Common Tasks

### Development Workflow
- Start dev server: `pnpm dev`
- The development server provides:
  - Local R2 bucket simulation
  - Local D1 database
  - Hot reloading for code changes
  - Access to all environment variables defined in wrangler.json

### Database Management
- Check database contents: `npx wrangler d1 execute blog-db --local --command="SELECT * FROM blog_posts"`
- Reset database: Delete `.wrangler` directory and re-run migration commands
- For production database, remove `--local` flag from wrangler commands

### Environment Variables
The application uses these environment variables (configured in wrangler.json):
- `ORIGINS`: Allowed CORS origins (default: ["http://localhost:3000"])
- `EZ_SECRET`: Authentication token for uploads (default: "secret")
- `R2`: R2 bucket binding for file storage
- `DB`: D1 database binding for metadata storage

### API Endpoints
- `GET /` - Returns "ragebaited"
- `GET /health` - Returns "OK"
- `GET /list` - Lists all blog posts
- `GET /post/:id` - Retrieves specific post with markdown content
- `POST /create-blog` - Creates new blog post (requires file, header, token, title)
- `DELETE /post/:id` - Deletes blog post and associated files
- `GET /img/:key` - Serves images from R2 (localhost only)
- `GET /list-r2` - Lists R2 objects (localhost only)
- `POST /upload-img` - Upload image only (separate from blog creation)

### Project Structure
Key files and directories:
- `src/index.ts` - Main application entry point with API routes
- `src/validations/upload.ts` - Zod validation schemas
- `migrations/` - Database schema migrations
- `wrangler.json` - Cloudflare Worker configuration
- `worker-configuration.d.ts` - Generated TypeScript types
- `package.json` - Dependencies and scripts

### Dependencies
- `hono` - Web framework for Cloudflare Workers
- `nanoid` - ID generation for posts and file keys
- `zod` - Runtime type validation
- `@cloudflare/workers-types` - TypeScript types for Cloudflare Workers
- `wrangler` - Cloudflare Workers CLI

### Timing Expectations
All commands are fast (under 5 seconds):
- Package installation: 3-4 seconds
- Database migrations: 1 second each
- TypeScript generation: 1 second
- Deployment build: 1 second
- Dev server startup: immediate

### Troubleshooting
- If `/list` endpoint returns "Internal server error", run database migrations
- If development server won't start, check that port 8787 is available
- If uploads fail, verify the token matches `EZ_SECRET` environment variable
- Missing `r2_key` or `header` column errors indicate incomplete database migrations

### No Tests or Linting
This project does not include automated tests or linting. Manual validation of functionality is required after all changes.