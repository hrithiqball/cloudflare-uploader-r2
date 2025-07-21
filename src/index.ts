import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { R2Bucket, D1Database } from '@cloudflare/workers-types'
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

      const key = `${new Date().toISOString().replace(/[:.]/g, '-')}-${file.name}`
      const buffer = await file.arrayBuffer()

      await c.env.R2.put(key, buffer)
      await c.env.DB.prepare(
        `INSERT INTO blog_posts (id, title, description, tags, category)
        VALUES (?, ?, ?, ?, ?)`
      )
        .bind(key, title, description || '', tags || '', category)
        .run()

      return c.json({ message: 'Uploaded', file: key })
    } catch (error) {
      console.error('Upload error:', error)
      return c.json({ message: 'Internal server error' }, 500)
    }
  })
  .get('/list', async (c) => {
    const objects = await c.env.R2.list()
    const files = objects.objects.map((obj) => obj.key)

    return c.json({ files })
  })

export default app
