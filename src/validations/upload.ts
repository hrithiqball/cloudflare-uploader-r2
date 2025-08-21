import { z } from 'zod'

export const fileSchema = z.object({
  file: z
    .instanceof(File)
    .refine((file) => file.size > 0, {
      message: 'File cannot be empty'
    })
    .refine((file) => file.size <= 10 * 1024 * 1024, {
      message: 'File size must be less than 10MB'
    })
    .refine(
      (file) => {
        return file.name.toLowerCase().endsWith('.md') || file.type === 'text/markdown'
      },
      {
        message: 'Only .md (Markdown) files are allowed'
      }
    ),
  token: z.string().min(1, 'Token is required')
})

export const uploadSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be less than 200 characters'),
  description: z.string().max(1000, 'Description must be less than 1000 characters').optional(),
  category: z
    .string()
    .min(1, 'Category is required')
    .max(50, 'Category must be less than 50 characters'),
  tags: z.string().max(200, 'Tags must be less than 200 characters').optional()
})

export const uploadRequestSchema = z.object({
  file: fileSchema.shape.file,
  token: fileSchema.shape.token,
  title: uploadSchema.shape.title,
  description: uploadSchema.shape.description,
  category: uploadSchema.shape.category,
  tags: uploadSchema.shape.tags
})

export const blogPostSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  tags: z.string().nullable(),
  category: z.string().nullable(),
  r2_key: z.string(),
  created_at: z.string(),
  header: z.string().nullable(),
  slug: z.string()
})

export type UploadRequest = z.infer<typeof uploadRequestSchema>
export type BlogPost = z.infer<typeof blogPostSchema>
