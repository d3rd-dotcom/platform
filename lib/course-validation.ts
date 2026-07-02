/**
 * Publish readiness validation for custom courses.
 * Pure module — safe to import from both the course builder (client)
 * and the publish API route (server). Server-side is authoritative.
 */

export interface ValidatableBlock {
  blockType: string;
  config: Record<string, unknown>;
}

export interface ValidatableComponent {
  componentType: string;
  title: string;
  config: Record<string, unknown>;
  blocks?: ValidatableBlock[];
}

export interface ValidatableWeek {
  weekNumber: number;
  components: ValidatableComponent[];
}

interface QuizOption { id?: string; text?: string; isCorrect?: boolean }
interface QuizQuestion { id?: string; text?: string; options?: QuizOption[] }

function isWeeklyRead(comp: ValidatableComponent): boolean {
  return comp.componentType === 'rich_text'
    && (comp.title === 'Weekly Read' || (comp.config as Record<string, unknown>)?._isReading === true);
}

function validateBlockConfig(blockType: string, config: Record<string, unknown>, where: string, issues: string[]) {
  switch (blockType) {
    case 'quiz_block': {
      const questions = (config.questions as QuizQuestion[] | undefined) ?? [];
      if (questions.length === 0) {
        issues.push(`${where}: quiz has no questions.`);
        break;
      }
      questions.forEach((q, qi) => {
        const label = `${where}: quiz question ${qi + 1}`;
        if (!q.text || !q.text.trim()) issues.push(`${label} has no text.`);
        const options = q.options ?? [];
        if (options.length < 2) issues.push(`${label} needs at least two options.`);
        if (options.some((o) => !o.text || !o.text.trim())) issues.push(`${label} has an empty option.`);
        if (!options.some((o) => o.isCorrect)) issues.push(`${label} has no correct answer marked.`);
      });
      break;
    }
    case 'multiple_choice': {
      const question = config.question as string | undefined;
      const options = (config.options as QuizOption[] | undefined) ?? [];
      if (!question || !question.trim()) issues.push(`${where}: multiple choice has no question.`);
      if (options.length < 2) issues.push(`${where}: multiple choice needs at least two options.`);
      if (options.some((o) => !o.text || !o.text.trim())) issues.push(`${where}: multiple choice has an empty option.`);
      break;
    }
    case 'media_embed':
    case 'image_embed':
    case 'video_embed': {
      const url = config.url as string | undefined;
      if (!url || !url.trim()) issues.push(`${where}: media block has no image or video.`);
      break;
    }
    case 'reflection_journal': {
      const prompt = config.prompt as string | undefined;
      if (!prompt || !prompt.trim()) issues.push(`${where}: field notes block has no prompt.`);
      break;
    }
    case 'nft_gate': {
      const collection = config.collection as string | undefined;
      const contractAddress = config.contractAddress as string | undefined;
      if (collection === 'custom' && (!contractAddress || !contractAddress.trim())) {
        issues.push(`${where}: custom NFT gate has no contract address.`);
      }
      break;
    }
    default:
      break;
  }
}

/**
 * Returns a list of human-readable issues blocking publish. Empty = ready.
 * Weeks should include the Weekly Read component if one exists (the server
 * shape); the builder injects a synthetic one from its reading state.
 */
export function validateCourseContent(weeks: ValidatableWeek[]): string[] {
  const issues: string[] = [];

  if (weeks.length === 0) {
    issues.push('Course has no weeks.');
    return issues;
  }

  for (const week of weeks) {
    const wk = `Week ${week.weekNumber}`;
    const reading = week.components.find(isWeeklyRead);
    const readingContent = reading ? ((reading.config.content as string | undefined) ?? '') : '';
    if (!readingContent.replace(/<[^>]*>/g, '').trim()) {
      issues.push(`${wk}: missing a Weekly Read.`);
    }

    const missions = week.components.filter((c) => !isWeeklyRead(c));
    if (missions.length === 0) {
      issues.push(`${wk}: has no missions.`);
      continue;
    }

    missions.forEach((m, mi) => {
      const name = m.title.trim() || `mission ${mi + 1}`;
      const where = `${wk}, ${name}`;
      if (!m.title.trim()) issues.push(`${wk}: mission ${mi + 1} has no title.`);

      if (m.componentType === 'mission_container') {
        const blocks = m.blocks ?? [];
        if (blocks.length === 0) {
          issues.push(`${where}: has no content blocks.`);
          return;
        }
        for (const block of blocks) {
          validateBlockConfig(block.blockType, block.config, where, issues);
        }
      } else {
        validateBlockConfig(m.componentType, m.config, where, issues);
      }
    });
  }

  return issues;
}
