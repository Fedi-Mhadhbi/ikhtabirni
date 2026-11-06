-- لا تسمح للطالب بتعديل حالة جلسته أو تزوير درجات الإجابات عبر REST.
revoke update on public.quiz_sessions from authenticated;
revoke insert on public.submissions from authenticated;
revoke insert on public.student_answers from authenticated;
drop policy if exists "participants see own submissions" on public.submissions;
drop policy if exists "participants see own answers" on public.student_answers;

create or replace function public.publish_quiz(quiz_id uuid) returns text
language plpgsql security definer set search_path=public,extensions as $$
declare code text;
begin
  if not exists(select 1 from public.quizzes where id=quiz_id and teacher_id=auth.uid()) then raise exception 'not found'; end if;
  if not exists(select 1 from public.questions where questions.quiz_id=publish_quiz.quiz_id) then raise exception 'quiz needs questions'; end if;
  code:=coalesce((select access_code from public.quizzes where id=quiz_id),upper(substr(encode(gen_random_bytes(8),'hex'),1,12)));
  update public.quizzes set access_code=code,status='published',published_at=coalesce(published_at,now()),closed_at=null where id=quiz_id;
  return code;
end $$;

create or replace function public.session_quiz(session_id uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare result jsonb;
begin
  if not exists(select 1 from public.quiz_sessions where id=session_id and participant_id=auth.uid() and status='in_progress') then raise exception 'session unavailable'; end if;
  select jsonb_build_object('title',q.title,'student_name',s.student_name,'questions',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'question_text',x.question_text,'question_type',x.question_type,'points',x.points,'teacher_audio_path',x.teacher_audio_path,'answers',(select jsonb_agg(jsonb_build_object('id',a.id,'answer_text',a.answer_text) order by a.position) from public.answers a where a.question_id=x.id)) order by x.position) from public.questions x where x.quiz_id=q.id),'[]'::jsonb))
  into result from public.quiz_sessions s join public.quizzes q on q.id=s.quiz_id where s.id=session_id;
  return result;
end $$;

create or replace function public.join_quiz(quiz_code text,display_name text) returns uuid
language plpgsql security definer set search_path=public as $$
declare quiz_uuid uuid; session_uuid uuid; current_status text;
begin
  select id into quiz_uuid from public.quizzes where access_code=upper(quiz_code) and status='published';
  if quiz_uuid is null then raise exception 'quiz unavailable'; end if;
  insert into public.quiz_sessions(quiz_id,participant_id,student_name) values(quiz_uuid,auth.uid(),trim(display_name)) on conflict(quiz_id,participant_id) do nothing;
  select id,status into session_uuid,current_status from public.quiz_sessions where quiz_id=quiz_uuid and participant_id=auth.uid();
  if current_status<>'in_progress' then raise exception 'attempt already submitted'; end if;
  return session_uuid;
end $$;

create or replace function public.submit_quiz(session_id uuid,answer_payload jsonb) returns uuid
language plpgsql security definer set search_path=public as $$
declare s public.quiz_sessions; sub_id uuid; q record; a jsonb; score numeric:=0; awarded numeric; expected uuid[]; selected uuid[]; actual_text text; expected_text text;
begin
  select * into s from public.quiz_sessions where id=session_id and participant_id=auth.uid() and status='in_progress' for update;
  if not found then raise exception 'session unavailable'; end if;
  insert into public.submissions(quiz_id,session_id,maximum_score) values(s.quiz_id,s.id,(select coalesce(sum(points),0) from public.questions where quiz_id=s.quiz_id)) returning id into sub_id;
  for q in select * from public.questions where quiz_id=s.quiz_id loop
    a:=coalesce((select v from jsonb_array_elements(answer_payload) v where v->>'question_id'=q.id::text limit 1),'{}'::jsonb); awarded:=null;
    if q.question_type in('multiple_choice','true_false') then
      select array_agg(id order by id) into expected from public.answers where question_id=q.id and is_correct;
      select array_agg(value::uuid order by value::uuid) into selected from jsonb_array_elements_text(coalesce(a->'selected_answer_ids','[]'::jsonb)) as el(value);
      awarded:=case when coalesce(expected,'{}')=coalesce(selected,'{}') then q.points else 0 end; score:=score+awarded;
    elsif q.question_type='fill_blank' then
      actual_text:=lower(trim(coalesce(a->>'answer_text','')));
      select lower(trim(answer_text)) into expected_text from public.answers where question_id=q.id and is_correct limit 1;
      if expected_text is not null then awarded:=case when actual_text=expected_text then q.points else 0 end; score:=score+awarded; end if;
    end if;
    insert into public.student_answers(submission_id,question_id,answer_text,selected_answer_ids,audio_path,awarded_points,review_status)
      values(sub_id,q.id,a->>'answer_text',coalesce(array(select value::uuid from jsonb_array_elements_text(coalesce(a->'selected_answer_ids','[]'::jsonb)) as el(value)),'{}'),a->>'audio_path',awarded,case when awarded is null then 'pending'::public.review_kind else 'auto'::public.review_kind end);
  end loop;
  update public.submissions set total_score=score,grading_status=case when exists(select 1 from public.student_answers where submission_id=sub_id and review_status='pending') then 'partial' else 'complete' end where id=sub_id;
  update public.quiz_sessions set status='submitted',submitted_at=now() where id=s.id;
  return sub_id;
end $$;

drop policy if exists "teacher audio owned quiz" on storage.objects;
create policy "teacher audio owned quiz" on storage.objects for all to authenticated
using(bucket_id='teacher-audio' and exists(select 1 from public.quizzes q where q.id::text=split_part(name,'/',1) and q.teacher_id=auth.uid()))
with check(bucket_id='teacher-audio' and exists(select 1 from public.quizzes q where q.id::text=split_part(name,'/',1) and q.teacher_id=auth.uid()));
create policy "students read audio for their open quizzes" on storage.objects for select to authenticated
using(bucket_id='teacher-audio' and exists(select 1 from public.questions x join public.quizzes q on q.id=x.quiz_id join public.quiz_sessions s on s.quiz_id=q.id where x.teacher_audio_path=name and q.status='published' and s.participant_id=auth.uid() and s.status='in_progress'));

do $$ begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='quiz_sessions') then alter publication supabase_realtime add table public.quiz_sessions; end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='submissions') then alter publication supabase_realtime add table public.submissions; end if;
end $$;
