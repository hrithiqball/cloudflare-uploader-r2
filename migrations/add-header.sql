ALTER TABLE blog_posts ADD COLUMN header TEXT;
UPDATE blog_posts SET header = 'Default Header';