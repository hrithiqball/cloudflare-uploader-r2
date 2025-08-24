import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { nanoid } from 'nanoid/non-secure'
import { blogPostSchema, fileSchema } from './validations/upload'
import { generateSlug, ensureUniqueSlug } from './utils/slug'

const app = new Hono<{ Bindings: CloudflareBindings }>()

app.use('*', (c, next) => {
  return cors({
    origin: c.env.ORIGINS,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization']
  })(c, next)
})

app
  .get('/', (c) => c.text('ragebaited'))
  .get('/health', (c) => c.text('OK'))
  .get('/img/:key', async (c) => {
    if (c.req.header('host') !== 'localhost:8787') {
      return c.json({ message: 'Not found' }, 404)
    }
    const objectKey = c.req.param('key')
    const object = await c.env.R2.get(objectKey)

    if (!object) {
      return c.json({ message: 'Image not found' }, 404)
    }

    return new Response(object.body, {
      headers: {
        'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
        'Content-Disposition': 'inline',
        'Cache-Control': 'public, max-age=31536000, immutable'
      }
    })
  })
  .get('/list-r2', async (c) => {
    if (c.req.header('host') !== 'localhost:8787') {
      return c.json({ message: 'Not found' }, 404)
    }

    const objects = await c.env.R2.list()

    return c.json({
      message: 'List of R2 objects',
      objects: objects.objects.map((obj) => ({
        key: obj.key,
        size: obj.size,
        etag: obj.etag
      }))
    })
  })
  .post('/upload-img', async (c) => {
    try {
      const form = await c.req.formData()

      const input = { file: form.get('file'), token: form.get('token') }

      const { data, error, success } = fileSchema.safeParse(input)

      if (!success) {
        const errors = error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message
        }))
        return c.json({ message: 'Validation failed', details: errors }, 400)
      }

      const { file, token } = data

      if (token !== c.env.EZ_SECRET) {
        return c.json({ message: 'Invalid token' }, 403)
      }

      const key = `${nanoid()}-${file.name}`
      const buffer = await file.arrayBuffer()

      await c.env.R2.put(key, buffer, {
        httpMetadata: {
          contentType: file.type || 'image/png'
        }
      })

      return c.json({ message: 'Image uploaded', key })
    } catch (error) {
      console.error('Upload error:', error)
      return c.json({ message: 'Internal server error' }, 500)
    }
  })
  .post('/create-blog', async (c) => {
    try {
      const form = await c.req.formData()

      const formData = {
        header: form.get('header'),
        file: form.get('file'),
        token: form.get('token'),
        title: form.get('title'),
        description: form.get('description'),
        category: form.get('category'),
        tags: form.get('tags'),
        markdown: form.get('markdown')
      }

      if (formData.token !== c.env.EZ_SECRET) {
        return c.json({ message: 'Invalid token' }, 403)
      }

      const { title, description, category, tags, file, markdown, header } = formData

      if (!(header instanceof File)) {
        console.error('Header is not an image file:', header)
        return c.json({ message: 'Header must be a file' }, 400)
      }

      let fileInput = null
      if (file instanceof File) {
        fileInput = file
      } else if (typeof markdown === 'string' && markdown.trim() !== '') {
        fileInput = new File([markdown], 'post.md', { type: 'text/markdown' })
      }

      if (!fileInput) {
        return c.json({ message: 'File or markdown content is required' }, 400)
      }

      const r2Key =
        fileInput && fileInput instanceof File
          ? `${new Date().toISOString().replace(/[:.]/g, '-')}-${fileInput.name}`
          : `${new Date().toISOString().replace(/[:.]/g, '-')}-post.md`

      const headerKey = `${new Date().toISOString().replace(/[:.]/g, '-')}-header-${nanoid()}.png`

      const postId = nanoid()
      const buffer = await fileInput.arrayBuffer()
      const headerBuffer = await header.arrayBuffer()

      // Generate slug from title
      const baseSlug = generateSlug(title as string)

      // Check for existing slugs to ensure uniqueness
      const existingSlugsResult = await c.env.DB.prepare('SELECT slug FROM blog_posts').all()
      const existingSlugs = existingSlugsResult.results.map((row: any) => row.slug)
      const uniqueSlug = ensureUniqueSlug(baseSlug, existingSlugs)

      await c.env.R2.put(r2Key, buffer)
      await c.env.R2.put(headerKey, headerBuffer)
      await c.env.DB.prepare(
        `INSERT INTO blog_posts (id, title, description, tags, category, r2_key, header, slug)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(postId, title, description || '', tags || '', category, r2Key, headerKey, uniqueSlug)
        .run()

      return c.json({ message: 'Uploaded', postId, r2Key, slug: uniqueSlug })
    } catch (error) {
      console.error('Upload error:', error)
      return c.json({ message: 'Internal server error' }, 500)
    }
  })
  .get('/list', async (c) => {
    try {
      const result = await c.env.DB.prepare(
        `SELECT id, title, description, tags, category, r2_key, created_at, header, slug FROM blog_posts ORDER BY created_at DESC`
      ).all()

      return c.json({ posts: result.results })
    } catch (error) {
      console.error('List error:', error)
      return c.json({ message: 'Internal server error' }, 500)
    }
  })
  .get('/post/:slug', async (c) => {
    const { slug } = c.req.param()
    try {
      const result = await c.env.DB.prepare(
        `SELECT id, title, description, tags, category, r2_key, created_at, header, slug FROM blog_posts WHERE slug = ?`
      )
        .bind(slug)
        .first()

      if (!result) {
        return c.json({ message: 'Post not found' }, 404)
      }

      const validationResult = blogPostSchema.safeParse(result)

      if (!validationResult.success) {
        console.error('Database validation error:', validationResult.error)
        return c.json({ message: 'Invalid post data' }, 500)
      }

      const validatedPost = validationResult.data
      const object = await c.env.R2.get(validatedPost.r2_key)

      if (!object) {
        return c.json({ message: 'Post content not found' }, 404)
      }

      const markdown = await object.text()

      return c.json({ post: { ...validatedPost, markdown } })
    } catch (error) {
      console.error('Post retrieval by slug error:', error)
      return c.json({ message: 'Internal server error' }, 500)
    }
  })
  .delete('/post/:id', async (c) => {
    const { id } = c.req.param()
    try {
      const post = await c.env.DB.prepare(`SELECT r2_key FROM blog_posts WHERE id = ?`)
        .bind(id)
        .first()

      if (!post) {
        return c.json({ message: 'Post not found' }, 404)
      }

      if (typeof post.r2_key !== 'string' || !post.r2_key) {
        return c.json({ message: 'Invalid R2 key' }, 400)
      }

      await c.env.R2.delete(post.r2_key)
      await c.env.DB.prepare(`DELETE FROM blog_posts WHERE id = ?`).bind(id).run()

      return c.json({ message: 'Post deleted' })
    } catch (error) {
      console.error('Delete error:', error)
      return c.json({ message: 'Internal server error' }, 500)
    }
  })

export default app
