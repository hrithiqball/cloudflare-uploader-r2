ALTER TABLE blog_posts ADD COLUMN r2_key TEXT;
UPDATE blog_posts SET r2_key = id;
