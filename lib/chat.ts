import { sqlQuery } from './db';
import { ensureChatSchema } from './ensureChatSchema';

export async function postSystemMessage(
  userId: string,
  username: string,
  avatarUrl: string | null,
  message: string,
) {
  await ensureChatSchema();

  const result = await sqlQuery<Array<{ id: number; created_at: string }>>(
    `INSERT INTO chat_messages (user_id, username, avatar_url, message, type)
     VALUES (:userId, :username, :avatarUrl, :message, 'system')
     RETURNING id, created_at`,
    { userId, username, avatarUrl, message }
  );

  return result[0];
}
