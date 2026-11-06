-- Let authenticated teachers create quizzes without supplying another user's ID.
alter table public.quizzes alter column teacher_id set default auth.uid();

-- This RPC returns only the title, description, and subject of an open published quiz.
-- Students need it before signing in anonymously; answer keys remain inaccessible.
grant execute on function public.get_public_quiz(text) to anon;
