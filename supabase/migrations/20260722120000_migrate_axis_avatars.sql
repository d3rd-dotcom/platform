-- Move generated user avatars from DiceBear to the app-owned three-axis renderer.
-- Custom uploads, Academic Angel avatars, and null avatars are preserved.

UPDATE public.users
SET avatar_url = '/api/avatars/render?seed=' || replace(selected_avatar_id, '#', '%23')
WHERE selected_avatar_id IS NOT NULL
  AND avatar_url LIKE 'https://api.dicebear.com/%';

UPDATE public.user_avatars
SET avatar_url = '/api/avatars/render?seed=' || replace(avatar_id, '#', '%23')
WHERE avatar_url LIKE 'https://api.dicebear.com/%';

-- Chat rows denormalize the avatar URL. Convert their original DiceBear seed so
-- historical messages stop making third-party avatar requests as well.
UPDATE public.chat_messages
SET avatar_url = '/api/avatars/render?seed=' || substring(avatar_url FROM '[?&]seed=([^&]+)')
WHERE avatar_url LIKE 'https://api.dicebear.com/%'
  AND substring(avatar_url FROM '[?&]seed=([^&]+)') IS NOT NULL;
