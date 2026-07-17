export interface DailyNoteCoordinates {
  week: number;
  day: number;
}

export function parseDailyNoteQuestId(questId: string): DailyNoteCoordinates | null {
  const match = /^daily-notes-w([1-9]|1[0-2])-d([1-7])$/.exec(questId);
  if (!match) return null;
  return { week: Number(match[1]), day: Number(match[2]) };
}

export function parseBalloonMilestone(questId: string): number | null {
  const match = /^balloon-(\d+)$/.exec(questId);
  if (!match) return null;

  const count = Number(match[1]);
  if (!Number.isSafeInteger(count) || count < 5 || count > 100 || count % 5 !== 0) {
    return null;
  }
  return count;
}
