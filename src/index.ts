import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { type R2Bucket } from '@cloudflare/workers-types'

type Bindings = {
  R2: R2Bucket
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
    const form = await c.req.formData()
    const file = form.get('file')
    const token = form.get('token')

    if (token !== c.env.SECRET_R2_SERVICE) {
      return c.json({ error: 'Invalid token' }, 403)
    }

    if (!(file instanceof File) || file.size === 0) {
      return c.text('Invalid file', 400)
    }

    const key = `${new Date().toISOString().replace(/[:.]/g, '-')}-${file.name}`
    const buffer = await file.arrayBuffer()

    await c.env.R2.put(key, buffer)

    return c.json({ message: 'Uploaded', file: key })
  })
  .get('/list', async (c) => {
    const objects = await c.env.R2.list()
    const files = objects.objects.map((obj) => obj.key)

    return c.json({ files })
  })

export default app
