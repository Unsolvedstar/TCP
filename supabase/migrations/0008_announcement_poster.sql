-- Announcements can carry an optional poster image — same storage approach
-- as certificates/signatures elsewhere in this app (a resized data URI, no
-- Supabase Storage bucket). No RLS changes: the existing insert/update
-- policies aren't column-scoped, so anyone already allowed to post/edit an
-- announcement can set or change its poster.

alter table public.announcements add column if not exists poster text;
