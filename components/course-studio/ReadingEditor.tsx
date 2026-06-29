'use client';

import { useState, useEffect, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import LinkExtension from '@tiptap/extension-link';
import {
  TextB,
  TextItalic,
  TextHOne,
  TextHTwo,
  TextHThree,
  ListBullets,
  ListNumbers,
  Quotes,
  Code,
  Link as LinkIcon,
  ArrowCounterClockwise,
  ArrowClockwise,
} from '@phosphor-icons/react';
import styles from './ReadingEditor.module.css';

interface ReadingEditorProps {
  content: string;
  onSave: (content: string) => void;
  onClose: () => void;
}

export default function ReadingEditor({ content, onSave, onClose }: ReadingEditorProps) {
  const [isDirty, setIsDirty] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      LinkExtension.configure({
        openOnClick: false,
      }),
    ],
    content: content || '',
    onUpdate: () => setIsDirty(true),
    editorProps: {
      attributes: {
        class: styles.editorContent,
      },
    },
  });

  useEffect(() => {
    if (editor && content && !isDirty) {
      editor.commands.setContent(content);
    }
  }, [content, editor, isDirty]);

  const setLink = useCallback(() => {
    if (!editor) return;
    const prevUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL', prevUrl || 'https://');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor]);

  if (!editor) return null;

  const ToolBtn = ({ onClick, active, label, children }: { onClick: () => void; active?: boolean; label: string; children: React.ReactNode }) => (
    <button
      type="button"
      onClick={onClick}
      className={`${styles.toolBtn} ${active ? styles.toolBtnActive : ''}`}
      title={label}
      aria-label={label}
    >
      {children}
    </button>
  );

  return (
    <div className={styles.editor}>
      <div className={styles.header}>
        <span className={styles.badge}>Weekly Read</span>
      </div>

      <div className={styles.toolbar}>
        <ToolBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} label="Bold">
          <TextB size={16} />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} label="Italic">
          <TextItalic size={16} />
        </ToolBtn>

        <div className={styles.divider} />

        <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} label="Heading 1">
          <TextHOne size={16} />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} label="Heading 2">
          <TextHTwo size={16} />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} label="Heading 3">
          <TextHThree size={16} />
        </ToolBtn>

        <div className={styles.divider} />

        <ToolBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} label="Bullet List">
          <ListBullets size={16} />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} label="Numbered List">
          <ListNumbers size={16} />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} label="Blockquote">
          <Quotes size={16} />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive('code')} label="Code">
          <Code size={16} />
        </ToolBtn>

        <div className={styles.divider} />

        <ToolBtn onClick={setLink} active={editor.isActive('link')} label="Link">
          <LinkIcon size={16} />
        </ToolBtn>

        <div className={styles.spacer} />

        <ToolBtn onClick={() => editor.chain().focus().undo().run()} label="Undo">
          <ArrowCounterClockwise size={16} />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().redo().run()} label="Redo">
          <ArrowClockwise size={16} />
        </ToolBtn>
      </div>

      <EditorContent editor={editor} className={styles.editorArea} />

      <div className={styles.footer}>
        <button type="button" className={styles.cancelBtn} onClick={onClose}>Cancel</button>
        <button
          type="button"
          className={styles.saveBtn}
          onClick={() => { onSave(editor.getHTML()); onClose(); }}
        >
          Save
        </button>
      </div>
    </div>
  );
}
