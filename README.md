# Cloudflare R2 Uploader

This is a simple file uploader for Cloudflare R2 using Hono. It allows you to upload files to an R2 bucket with a dummy token for authentication.

##### To add new secret to cloudflare secrets, run:

```bash
pnpx wrangler secret put SECRET_R2_SERVICE
```

##### Local Development

```bash
pnpm dev
```

> This will start the development server and you can access it at `http://localhost:8787`. However, it is just a mock and does not upload a single file to R2

##### D1 Database

To run migrations for the D1 database, you can use the following command:

To run the uploader locally, you can use the following command:

> add `--local` flag to run it locally.

```bash
npx wrangler d1 execute blog-db --local --file=./migrations/init.sql
```

and to validate the database data

```bash
npx wrangler d1 execute blog-db --local --command="SELECT * FROM blog_posts"
```
