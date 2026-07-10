import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import RichTextRenderer from '@/components/course-renderers/RichTextRenderer';

function renderMarkdown(content: string) {
  return renderToStaticMarkup(
    React.createElement(RichTextRenderer, {
      component: {
        id: 'guide-body',
        weekId: '',
        sortOrder: 0,
        componentType: 'rich_text',
        title: '',
        config: { format: 'markdown', content },
        required: false,
        blocks: [],
        createdAt: '',
        updatedAt: '',
      },
    }),
  );
}

describe('RichTextRenderer markdown content', () => {
  it('renders Markdown emphasis, headings, lists, and links as HTML', () => {
    const html = renderMarkdown(
      '# Heading\n\nA **bold** idea and *emphasis*.\n\n- First item\n- Second item\n\n[Source](https://example.com)',
    );

    expect(html).toContain('<h1>Heading</h1>');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em>emphasis</em>');
    expect(html).toContain('<ul>');
    expect(html).toContain('<li>First item</li>');
    expect(html).toContain('href="https://example.com"');
    expect(html).not.toContain('**bold**');
  });

  it('drops unsafe Markdown link protocols', () => {
    const html = renderMarkdown('[Unsafe](javascript:alert(1))');

    expect(html).toContain('Unsafe');
    expect(html).not.toContain('javascript:');
  });
});
