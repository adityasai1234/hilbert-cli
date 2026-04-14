import { z } from "zod";

export const AuthorSchema = z.object({
  name: z.string(),
  affiliation: z.string().optional(),
  author_id: z.string().optional(),
});

export type Author = z.infer<typeof AuthorSchema>;

export const PaperSchema = z.object({
  paper_id: z.string(),
  title: z.string(),
  abstract: z.string(),
  authors: z.array(AuthorSchema),
  published_date: z.string().optional(),
  url: z.string(),
  arxiv_id: z.string().optional(),
  doi: z.string().optional(),
  venue: z.string().optional(),
  citation_count: z.number().default(0),
  is_open_access: z.boolean().default(true),
});

export type Paper = z.infer<typeof PaperSchema>;

export function citationKey(paper: Paper): string {
  if (paper.doi) return paper.doi.replace(/\//g, "-").replace(/\./g, "-");
  if (paper.arxiv_id) return `arxiv-${paper.arxiv_id}`;
  return `paper-${paper.paper_id.slice(0, 8)}`;
}

export function toBibtex(paper: Paper): string {
  const firstAuthor = paper.authors[0]?.name.split(" ").slice(-1)[0] || "Unknown";
  const year = paper.published_date ? new Date(paper.published_date).getFullYear() : "n.d.";
  const key = `${firstAuthor}${year}`;

  const entries = [
    `@article{${key},`,
    `  author = {${paper.authors.map((a) => a.name).join(" and ")}},`,
    `  title = {${paper.title}},`,
  ];

  if (paper.venue) entries.push(`  journal = {${paper.venue}},`);
  if (paper.published_date) {
    entries.push(`  year = {${new Date(paper.published_date).getFullYear()}},`);
  }
  if (paper.doi) entries.push(`  doi = {${paper.doi}},`);
  if (paper.url) entries.push(`  url = {${paper.url}},`);

  entries.push("}");
  return entries.join("\n");
}

export function toPaperText(paper: Paper): string {
  const truncatedAbstract =
    paper.abstract.length > 2000 ? paper.abstract.slice(0, 2000) + "..." : paper.abstract;
  return `${paper.title}\n\n${truncatedAbstract}`;
}