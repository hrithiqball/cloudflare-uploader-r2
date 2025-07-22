import type { D1Database, R2Bucket } from '@cloudflare/workers-types'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { nanoid } from 'nanoid/non-secure'
import { uploadRequestSchema } from './validations/upload'

type Bindings = {
  R2: R2Bucket
  DB: D1Database
  SECRET_R2_SERVICE: string
  ORIGINS: string[]
}

const app = new Hono<{ Bindings: Bindings }>()

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
  .post('/upload', async (c) => {
    try {
      const form = await c.req.formData()

      const formData = {
        file: form.get('file'),
        token: form.get('token'),
        title: form.get('title'),
        description: form.get('description'),
        category: form.get('category'),
        tags: form.get('tags')
      }

      const validationResult = uploadRequestSchema.safeParse(formData)

      if (!validationResult.success) {
        const errors = validationResult.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message
        }))
        return c.json({ message: 'Validation failed', details: errors }, 400)
      }

      const { file, token, title, description, category, tags } = validationResult.data

      if (token !== c.env.SECRET_R2_SERVICE) {
        return c.json({ message: 'Invalid token' }, 403)
      }

      const r2Key = `${new Date().toISOString().replace(/[:.]/g, '-')}-${file.name}`
      const postId = nanoid()
      const buffer = await file.arrayBuffer()

      await c.env.R2.put(r2Key, buffer)
      await c.env.DB.prepare(
        `INSERT INTO blog_posts (id, title, description, tags, category, r2_key)
        VALUES (?, ?, ?, ?, ?, ?)`
      )
        .bind(postId, title, description || '', tags || '', category, r2Key)
        .run()

      return c.json({ message: 'Uploaded', postId, r2Key })
    } catch (error) {
      console.error('Upload error:', error)
      return c.json({ message: 'Internal server error' }, 500)
    }
  })
  .get('/list', async (c) => {
    try {
      const result = await c.env.DB.prepare(
        `SELECT id, title, description, tags, category, r2_key, created_at FROM blog_posts ORDER BY created_at DESC`
      ).all()

      return c.json({ posts: result.results })
    } catch (error) {
      console.error('List error:', error)
      return c.json({ message: 'Internal server error' }, 500)
    }
  })
  .get('/post/:id', async (c) => {
    const { id } = c.req.param()
    try {
      const result = await c.env.DB.prepare(
        `SELECT id, title, description, tags, category, r2_key, created_at FROM blog_posts WHERE id = ?`
      )
        .bind(id)
        .first()

      if (!result) {
        return c.json({ message: 'Post not found' }, 404)
      }

      // TODO: validate with zod
      const object = await c.env.R2.get(result.r2_key)

      if (!object) {
        return c.json({ message: 'Post content not found' }, 404)
      }

      const markdown = await object.text()

      return c.json({ post: { ...result, markdown } })
    } catch (error) {
      console.error('Post retrieval error:', error)
      return c.json({ message: 'Internal server error' }, 500)
    }
  })

export default app
