grant update on public.submissions to authenticated;
create policy "teachers update quiz grading totals" on public.submissions for update to authenticated
using(exists(select 1 from public.quizzes q where q.id=quiz_id and q.teacher_id=auth.uid()))
with check(exists(select 1 from public.quizzes q where q.id=quiz_id and q.teacher_id=auth.uid()));
