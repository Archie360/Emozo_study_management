// Keeps the object key readable in the bucket (handy when eyeballing it in
// the Supabase dashboard) while stripping characters S3 keys don't like.
export function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9.\-_ ]/g, "_").slice(0, 200) || "file";
}
