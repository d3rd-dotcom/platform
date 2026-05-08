import { NextResponse } from 'next/server';
import {
  fetchLatestParagraphBlogPosts,
  PARAGRAPH_BLOG_REVALIDATE_SECONDS,
} from '@/lib/paragraph-blog';

export const revalidate = PARAGRAPH_BLOG_REVALIDATE_SECONDS;

export async function GET() {
  try {
    const posts = await fetchLatestParagraphBlogPosts(3);
    return NextResponse.json({ posts });
  } catch (error) {
    console.error('[blog/recent] Failed to fetch Paragraph posts', error);
    return NextResponse.json(
      { posts: [], error: 'Failed to fetch latest blog posts' },
      { status: 500 },
    );
  }
}
