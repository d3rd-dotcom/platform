export const PARAGRAPH_BLOG_REVALIDATE_SECONDS = 60 * 10;

const PARAGRAPH_BLOG_RSS_URL = 'https://api.paragraph.com/blogs/rss/%40mentalwealthacademy';

export interface ParagraphBlogPost {
  title: string;
  url: string;
  publishedAt: string;
  excerpt: string;
  imageUrl: string | null;
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, '\'')
    .replace(/&apos;/g, '\'')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

function extractXmlValue(block: string, tag: string): string | null {
  const escapedTag = tag.replace(':', '\\:');
  const match = block.match(new RegExp(`<${escapedTag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escapedTag}>`, 'i'));
  return match?.[1] ? decodeXmlEntities(match[1]) : null;
}

function stripHtml(value: string): string {
  return value
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength).trim()}...`;
}

function extractImageUrl(block: string): string | null {
  const enclosureMatch = block.match(/<enclosure\b[^>]*\burl="([^"]+)"/i);
  if (enclosureMatch?.[1]) {
    return decodeXmlEntities(enclosureMatch[1]);
  }

  const content = extractXmlValue(block, 'content:encoded') ?? '';
  const imageMatch = content.match(/<img\b[^>]*\bsrc="([^"]+)"/i);
  return imageMatch?.[1] ? decodeXmlEntities(imageMatch[1]) : null;
}

function parseParagraphBlogPosts(xml: string): ParagraphBlogPost[] {
  return Array.from(xml.matchAll(/<item\b[\s\S]*?>([\s\S]*?)<\/item>/gi))
    .map((match) => {
      const block = match[1];
      const title = extractXmlValue(block, 'title');
      const url = extractXmlValue(block, 'link');
      const publishedAt = extractXmlValue(block, 'pubDate');
      const description = extractXmlValue(block, 'description') ?? '';
      const publishedAtTimestamp = publishedAt ? Date.parse(publishedAt) : Number.NaN;

      if (!title || !url || !Number.isFinite(publishedAtTimestamp)) {
        return null;
      }

      return {
        title,
        url,
        publishedAt: new Date(publishedAtTimestamp).toISOString(),
        excerpt: truncate(stripHtml(description), 180),
        imageUrl: extractImageUrl(block),
      };
    })
    .filter((post): post is ParagraphBlogPost => post !== null)
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
}

export async function fetchLatestParagraphBlogPosts(limit = 3): Promise<ParagraphBlogPost[]> {
  const response = await fetch(PARAGRAPH_BLOG_RSS_URL, {
    headers: {
      Accept: 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
      'User-Agent': 'MentalWealthAcademy/1.0',
    },
    next: { revalidate: PARAGRAPH_BLOG_REVALIDATE_SECONDS },
  });

  if (!response.ok) {
    throw new Error(`Paragraph RSS request failed with status ${response.status}`);
  }

  const xml = await response.text();
  return parseParagraphBlogPosts(xml).slice(0, limit);
}
