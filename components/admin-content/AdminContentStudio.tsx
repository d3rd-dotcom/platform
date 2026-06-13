'use client';

import { useEffect, useMemo, useState } from 'react';
import styles from './AdminContentStudio.module.css';

type Status = 'draft' | 'published' | 'archived';
type EntityType = 'course' | 'chapter' | 'lesson';

interface LessonNode {
  id: string;
  chapterId: string;
  slug: string;
  title: string;
  lessonType: 'article' | 'video' | 'assignment' | 'quiz';
  bodyMarkdown: string;
  videoUrl: string | null;
  resourceUrl: string | null;
  status: Status;
  sortOrder: number;
  durationMinutes: number | null;
}

interface ChapterNode {
  id: string;
  courseId: string;
  slug: string;
  title: string;
  summary: string;
  status: Status;
  sortOrder: number;
  lessons: LessonNode[];
}

interface CourseNode {
  id: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  status: Status;
  sortOrder: number;
  coverImageUrl: string | null;
  estimatedWeeks: number | null;
  chapters: ChapterNode[];
}

interface ContentResponse {
  content: {
    courses: CourseNode[];
  };
}

interface CourseDraft {
  slug: string;
  title: string;
  summary: string;
  description: string;
  status: Status;
  sortOrder: number;
  coverImageUrl: string;
  estimatedWeeks: string;
}

interface ChapterDraft {
  courseId: string;
  slug: string;
  title: string;
  summary: string;
  status: Status;
  sortOrder: number;
}

interface LessonDraft {
  chapterId: string;
  slug: string;
  title: string;
  lessonType: LessonNode['lessonType'];
  bodyMarkdown: string;
  videoUrl: string;
  resourceUrl: string;
  status: Status;
  sortOrder: number;
  durationMinutes: string;
}

const emptyCourse: CourseDraft = {
  slug: '',
  title: '',
  summary: '',
  description: '',
  status: 'draft' as Status,
  sortOrder: 0,
  coverImageUrl: '',
  estimatedWeeks: '',
};

const emptyChapter: ChapterDraft = {
  courseId: '',
  slug: '',
  title: '',
  summary: '',
  status: 'draft' as Status,
  sortOrder: 0,
};

const emptyLesson: LessonDraft = {
  chapterId: '',
  slug: '',
  title: '',
  lessonType: 'article' as LessonNode['lessonType'],
  bodyMarkdown: '',
  videoUrl: '',
  resourceUrl: '',
  status: 'draft' as Status,
  sortOrder: 0,
  durationMinutes: '',
};

function saveSecret(secret: string) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem('mwa-admin-secret', secret);
}

function loadSecret() {
  if (typeof window === 'undefined') return '';
  return sessionStorage.getItem('mwa-admin-secret') || '';
}

export default function AdminContentStudio() {
  const [secret, setSecret] = useState('');
  const [isAuthed, setIsAuthed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [courses, setCourses] = useState<CourseNode[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [entityType, setEntityType] = useState<EntityType>('course');
  const [courseDraft, setCourseDraft] = useState(emptyCourse);
  const [chapterDraft, setChapterDraft] = useState(emptyChapter);
  const [lessonDraft, setLessonDraft] = useState(emptyLesson);

  const selectedCourse = useMemo(
    () => courses.find((course) => course.id === selectedCourseId) ?? null,
    [courses, selectedCourseId],
  );
  const selectedChapter = useMemo(
    () => selectedCourse?.chapters.find((chapter) => chapter.id === selectedChapterId) ?? null,
    [selectedCourse, selectedChapterId],
  );
  const selectedLesson = useMemo(
    () => selectedChapter?.lessons.find((lesson) => lesson.id === selectedLessonId) ?? null,
    [selectedChapter, selectedLessonId],
  );

  const headers = useMemo(
    () => ({
      'Content-Type': 'application/json',
      'x-admin-secret': secret,
    }),
    [secret],
  );

  const loadContent = async (activeSecret = secret) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/content', {
        cache: 'no-store',
        headers: {
          'x-admin-secret': activeSecret,
        },
      });
      const data: ContentResponse = await res.json();
      if (!res.ok) {
        throw new Error((data as any)?.error || 'Unable to load content');
      }
      setCourses(data.content.courses);
      const firstCourse = data.content.courses[0] ?? null;
      setSelectedCourseId((prev) => prev ?? firstCourse?.id ?? null);
      setSelectedChapterId((prev) => prev ?? firstCourse?.chapters[0]?.id ?? null);
      setSelectedLessonId((prev) => prev ?? firstCourse?.chapters[0]?.lessons[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load content');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const saved = loadSecret();
    if (saved) {
      setSecret(saved);
      setIsAuthed(true);
      void loadContent(saved);
    }
  }, []);

  const submitSecret = async () => {
    saveSecret(secret);
    setIsAuthed(true);
    await loadContent(secret);
  };

  const submitCreate = async () => {
    setLoading(true);
    setError(null);
    try {
      const body =
        entityType === 'course'
          ? {
              entity: 'course',
              ...courseDraft,
              estimatedWeeks: courseDraft.estimatedWeeks ? Number(courseDraft.estimatedWeeks) : null,
            }
          : entityType === 'chapter'
            ? {
                entity: 'chapter',
                ...chapterDraft,
              }
            : {
                entity: 'lesson',
                ...lessonDraft,
                durationMinutes: lessonDraft.durationMinutes ? Number(lessonDraft.durationMinutes) : null,
              };

      const res = await fetch('/api/admin/content', {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Save failed');
      }

      if (entityType === 'course') setCourseDraft(emptyCourse);
      if (entityType === 'chapter') setChapterDraft({ ...emptyChapter, courseId: selectedCourseId ?? '' });
      if (entityType === 'lesson') setLessonDraft({ ...emptyLesson, chapterId: selectedChapterId ?? '' });
      await loadContent();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setLoading(false);
    }
  };

  const selectedMeta = selectedLesson ?? selectedChapter ?? selectedCourse;

  return (
    <div className={styles.shell}>
      <div className={styles.header}>
        <div>
          <p className={styles.kicker}>Academy content studio</p>
          <h1>Build the course structure</h1>
          <p className={styles.subcopy}>
            A native, Frappe-inspired workspace for courses, chapters, and lessons.
          </p>
        </div>
        <div className={styles.secretCard}>
          <label className={styles.label}>
            Admin secret
            <input
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              type="password"
              placeholder="Enter ADMIN_SECRET"
            />
          </label>
          <button type="button" onClick={submitSecret} disabled={!secret || loading}>
            {isAuthed ? 'Reconnect' : 'Unlock studio'}
          </button>
        </div>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.grid}>
        <aside className={styles.treePanel}>
          <div className={styles.panelTitleRow}>
            <h2>Content tree</h2>
            <span>{courses.length} course(s)</span>
          </div>

          {courses.map((course) => (
            <div key={course.id} className={styles.courseBlock}>
              <button
                type="button"
                className={`${styles.treeItem} ${selectedCourseId === course.id ? styles.treeItemActive : ''}`}
                onClick={() => {
                  setSelectedCourseId(course.id);
                  setSelectedChapterId(course.chapters[0]?.id ?? null);
                  setSelectedLessonId(course.chapters[0]?.lessons[0]?.id ?? null);
                }}
              >
                <span>{course.title}</span>
                <small>{course.status}</small>
              </button>

              <div className={styles.chapterList}>
                {course.chapters.map((chapter) => (
                  <div key={chapter.id}>
                    <button
                      type="button"
                      className={`${styles.treeItem} ${selectedChapterId === chapter.id ? styles.treeItemActive : ''}`}
                      onClick={() => {
                        setSelectedCourseId(course.id);
                        setSelectedChapterId(chapter.id);
                        setSelectedLessonId(chapter.lessons[0]?.id ?? null);
                      }}
                    >
                      <span>{chapter.title}</span>
                      <small>{chapter.status}</small>
                    </button>

                    <div className={styles.lessonList}>
                      {chapter.lessons.map((lesson) => (
                        <button
                          key={lesson.id}
                          type="button"
                          className={`${styles.lessonItem} ${selectedLessonId === lesson.id ? styles.lessonItemActive : ''}`}
                          onClick={() => {
                            setSelectedCourseId(course.id);
                            setSelectedChapterId(chapter.id);
                            setSelectedLessonId(lesson.id);
                          }}
                        >
                          {lesson.title}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </aside>

        <section className={styles.editorPanel}>
          <div className={styles.panelTitleRow}>
            <h2>Editor</h2>
            <span>
              {selectedLesson ? 'Lesson' : selectedChapter ? 'Chapter' : selectedCourse ? 'Course' : 'No selection'}
            </span>
          </div>

          <div className={styles.tabs}>
            {(['course', 'chapter', 'lesson'] as EntityType[]).map((entity) => (
              <button
                key={entity}
                type="button"
                className={`${styles.tab} ${entityType === entity ? styles.tabActive : ''}`}
                onClick={() => setEntityType(entity)}
              >
                {entity}
              </button>
            ))}
          </div>

          <div className={styles.formGrid}>
            {entityType === 'course' && (
              <>
                <label className={styles.label}>Slug<input value={courseDraft.slug} onChange={(e) => setCourseDraft({ ...courseDraft, slug: e.target.value })} /></label>
                <label className={styles.label}>Title<input value={courseDraft.title} onChange={(e) => setCourseDraft({ ...courseDraft, title: e.target.value })} /></label>
                <label className={styles.label}>Summary<input value={courseDraft.summary} onChange={(e) => setCourseDraft({ ...courseDraft, summary: e.target.value })} /></label>
                <label className={styles.label}>Description<textarea value={courseDraft.description} onChange={(e) => setCourseDraft({ ...courseDraft, description: e.target.value })} rows={5} /></label>
                <label className={styles.label}>Cover image URL<input value={courseDraft.coverImageUrl} onChange={(e) => setCourseDraft({ ...courseDraft, coverImageUrl: e.target.value })} /></label>
                <label className={styles.label}>Estimated weeks<input value={courseDraft.estimatedWeeks} onChange={(e) => setCourseDraft({ ...courseDraft, estimatedWeeks: e.target.value })} type="number" min={1} /></label>
                <label className={styles.label}>Sort order<input value={courseDraft.sortOrder} onChange={(e) => setCourseDraft({ ...courseDraft, sortOrder: Number(e.target.value) })} type="number" /></label>
                <label className={styles.label}>Status
                  <select value={courseDraft.status} onChange={(e) => setCourseDraft({ ...courseDraft, status: e.target.value as Status })}>
                    <option value="draft">draft</option>
                    <option value="published">published</option>
                    <option value="archived">archived</option>
                  </select>
                </label>
              </>
            )}

            {entityType === 'chapter' && (
              <>
                <label className={styles.label}>Course ID<input value={chapterDraft.courseId} onChange={(e) => setChapterDraft({ ...chapterDraft, courseId: e.target.value })} placeholder={selectedCourse?.id ?? ''} /></label>
                <label className={styles.label}>Slug<input value={chapterDraft.slug} onChange={(e) => setChapterDraft({ ...chapterDraft, slug: e.target.value })} /></label>
                <label className={styles.label}>Title<input value={chapterDraft.title} onChange={(e) => setChapterDraft({ ...chapterDraft, title: e.target.value })} /></label>
                <label className={styles.label}>Summary<input value={chapterDraft.summary} onChange={(e) => setChapterDraft({ ...chapterDraft, summary: e.target.value })} /></label>
                <label className={styles.label}>Sort order<input value={chapterDraft.sortOrder} onChange={(e) => setChapterDraft({ ...chapterDraft, sortOrder: Number(e.target.value) })} type="number" /></label>
                <label className={styles.label}>Status
                  <select value={chapterDraft.status} onChange={(e) => setChapterDraft({ ...chapterDraft, status: e.target.value as Status })}>
                    <option value="draft">draft</option>
                    <option value="published">published</option>
                    <option value="archived">archived</option>
                  </select>
                </label>
              </>
            )}

            {entityType === 'lesson' && (
              <>
                <label className={styles.label}>Chapter ID<input value={lessonDraft.chapterId} onChange={(e) => setLessonDraft({ ...lessonDraft, chapterId: e.target.value })} placeholder={selectedChapter?.id ?? ''} /></label>
                <label className={styles.label}>Slug<input value={lessonDraft.slug} onChange={(e) => setLessonDraft({ ...lessonDraft, slug: e.target.value })} /></label>
                <label className={styles.label}>Title<input value={lessonDraft.title} onChange={(e) => setLessonDraft({ ...lessonDraft, title: e.target.value })} /></label>
                <label className={styles.label}>Type
                  <select value={lessonDraft.lessonType} onChange={(e) => setLessonDraft({ ...lessonDraft, lessonType: e.target.value as LessonNode['lessonType'] })}>
                    <option value="article">article</option>
                    <option value="video">video</option>
                    <option value="assignment">assignment</option>
                    <option value="quiz">quiz</option>
                  </select>
                </label>
                <label className={styles.label}>Body markdown<textarea value={lessonDraft.bodyMarkdown} onChange={(e) => setLessonDraft({ ...lessonDraft, bodyMarkdown: e.target.value })} rows={8} /></label>
                <label className={styles.label}>Video URL<input value={lessonDraft.videoUrl} onChange={(e) => setLessonDraft({ ...lessonDraft, videoUrl: e.target.value })} /></label>
                <label className={styles.label}>Resource URL<input value={lessonDraft.resourceUrl} onChange={(e) => setLessonDraft({ ...lessonDraft, resourceUrl: e.target.value })} /></label>
                <label className={styles.label}>Duration minutes<input value={lessonDraft.durationMinutes} onChange={(e) => setLessonDraft({ ...lessonDraft, durationMinutes: e.target.value })} type="number" min={0} /></label>
                <label className={styles.label}>Sort order<input value={lessonDraft.sortOrder} onChange={(e) => setLessonDraft({ ...lessonDraft, sortOrder: Number(e.target.value) })} type="number" /></label>
                <label className={styles.label}>Status
                  <select value={lessonDraft.status} onChange={(e) => setLessonDraft({ ...lessonDraft, status: e.target.value as Status })}>
                    <option value="draft">draft</option>
                    <option value="published">published</option>
                    <option value="archived">archived</option>
                  </select>
                </label>
              </>
            )}
          </div>

          <button type="button" className={styles.primaryButton} onClick={submitCreate} disabled={loading || !isAuthed}>
            {loading ? 'Saving...' : `Create ${entityType}`}
          </button>

          {selectedMeta && (
            <div className={styles.preview}>
              <p className={styles.previewLabel}>Selected record</p>
              <h3>{selectedMeta.title}</h3>
              <p>{'summary' in selectedMeta ? selectedMeta.summary : selectedMeta.bodyMarkdown}</p>
              <pre>{JSON.stringify(selectedMeta, null, 2)}</pre>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
