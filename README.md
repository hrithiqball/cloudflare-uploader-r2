# Cloudflare R2 Uploader

This is a simple file uploader for Cloudflare R2 using Hono. It allows you to upload files to an R2 bucket with a dummy token for authentication.

##### To add new secret to cloudflare secrets, run:

```bash
bunx wrangler secret put SECRET_R2_SERVICE
```

##### Local Development

```bash
bun dev
```

> This will start the development server and you can access it at `http://localhost:8787`. However, it is just a mock and does not upload a single file to R2
