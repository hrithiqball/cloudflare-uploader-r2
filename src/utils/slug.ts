/**
 * Generate a URL-friendly slug from a title
 * @param title - The title to convert to a slug
 * @returns A URL-friendly slug
 */
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    // Replace spaces with hyphens
    .replace(/\s+/g, '-')
    // Replace forward slashes with hyphens
    .replace(/\//g, '-')
    // Replace backslashes with hyphens
    .replace(/\\/g, '-')
    // Replace ampersand with 'and'
    .replace(/&/g, 'and')
    // Replace @ with 'at'
    .replace(/@/g, 'at')
    // Replace % with 'percent'
    .replace(/%/g, 'percent')
    // Remove special characters
    .replace(/[?#!]/g, '')
    // Remove any remaining non-alphanumeric characters except hyphens
    .replace(/[^a-z0-9-]/g, '')
    // Replace multiple consecutive hyphens with single hyphen
    .replace(/-+/g, '-')
    // Remove leading and trailing hyphens
    .replace(/^-+|-+$/g, '')
}

/**
 * Ensure slug is unique by appending a suffix if needed
 * @param baseSlug - The base slug to check
 * @param existingSlugs - Array of existing slugs to check against
 * @returns A unique slug
 */
export function ensureUniqueSlug(baseSlug: string, existingSlugs: string[]): string {
  let slug = baseSlug
  let counter = 1
  
  while (existingSlugs.includes(slug)) {
    slug = `${baseSlug}-${counter}`
    counter++
  }
  
  return slug
}