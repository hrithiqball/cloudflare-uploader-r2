-- Add slug column as unique and not null
-- First add the column as nullable to allow data migration
ALTER TABLE blog_posts ADD COLUMN slug TEXT;

-- Update existing records with slugs generated from titles
-- Convert titles to URL-friendly slugs: lowercase, replace spaces/special chars with hyphens
UPDATE blog_posts SET slug = 
  LOWER(
    REPLACE(
      REPLACE(
        REPLACE(
          REPLACE(
            REPLACE(
              REPLACE(
                REPLACE(
                  REPLACE(
                    REPLACE(
                      REPLACE(title, ' ', '-'),
                      '/', '-'
                    ),
                    '\\', '-'
                  ),
                  '?', ''
                ),
                '&', 'and'
              ),
              '#', ''
            ),
            '!', ''
          ),
          '@', 'at'
        ),
        '%', 'percent'
      ),
      '--', '-'
    )
  )
WHERE slug IS NULL;

-- Handle potential duplicates by appending incremental numbers
-- This is a simplified approach - in production you'd want more sophisticated deduplication
UPDATE blog_posts 
SET slug = slug || '-' || id 
WHERE id != (
  SELECT MIN(id) 
  FROM blog_posts b2 
  WHERE b2.slug = blog_posts.slug
);

-- Now make the column NOT NULL and add unique constraint
-- Note: SQLite doesn't support adding NOT NULL constraint to existing columns directly
-- So we need to recreate the table

-- Create new table with slug as NOT NULL UNIQUE
CREATE TABLE blog_posts_new (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  tags TEXT,
  category TEXT,
  r2_key TEXT,
  header TEXT,
  slug TEXT NOT NULL UNIQUE,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Copy data from old table
INSERT INTO blog_posts_new (id, title, description, tags, category, r2_key, header, slug, created_at)
SELECT id, title, description, tags, category, r2_key, header, slug, created_at
FROM blog_posts;

-- Drop old table and rename new one
DROP TABLE blog_posts;
ALTER TABLE blog_posts_new RENAME TO blog_posts;