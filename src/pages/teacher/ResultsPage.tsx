import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, Headphones, Radio, RefreshCw, Save, X } from 'lucide-react';
import { useRealtimeResults } from '../../hooks/useRealtimeResults';
import { supabase } from '../../services/supabase/client';

type Submission = { id: string; session_id: string; total_score: number; maximum_score: number; grading_status: string; submitted_at: string };
type Student = { id: string; student_name: string; joined_at: string; status: string; submissions: Submission[] };
type Answer = {
  id: string;
  question_id: string;
  answer_text: string | null;
  selected_answer_ids: string[];
  audio_path: string | null;
  awarded_points: number | null;
  teacher_feedback: string | null;
  review_status: string;
  questions: { question_text: string; points: number; question_type: string; answers: { id: string; answer_text: string; is_correct: boolean }[] };
};

export default function ResultsPage() {
  const { id } = useParams();
  const [students, setStudents] = useState<Student[]>([]);
  const [quizTitle, setQuizTitle] = useState('');
  const [filter, setFilter] = useState<'all' | 'submitted' | 'active' | 'pending'>('all');
  const [selected, setSelected] = useState<Student | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [audioUrls, setAudioUrls] = useState<Record<string, string>>({});
  const [audioErrors, setAudioErrors] = useState<Record<string, boolean>>({});
  const [loadError, setLoadError] = useState('');
  const [modalMessage, setModalMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingAnswers, setLoadingAnswers] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!supabase || !id) return;
    setLoading(true);
    setLoadError('');
    try {
      const [quizResult, sessionsResult, submissionsResult] = await Promise.all([
        supabase.from('quizzes').select('title').eq('id', id).single(),
        supabase.from('quiz_sessions').select('id,student_name,joined_at,status').eq('quiz_id', id).order('joined_at', { ascending: false }),
        supabase.from('submissions').select('id,session_id,total_score,maximum_score,grading_status,submitted_at').eq('quiz_id', id),
      ]);
      if (quizResult.error) throw quizResult.error;
      if (sessionsResult.error) throw sessionsResult.error;
      if (submissionsResult.error) throw submissionsResult.error;

      const bySession = new Map<string, Submission[]>();
      for (const submission of (submissionsResult.data || []) as Submission[]) {
        const existing = bySession.get(submission.session_id) || [];
        existing.push(submission);
        bySession.set(submission.session_id, existing);
      }
      setQuizTitle(quizResult.data.title);
      setStudents(((sessionsResult.data || []) as Omit<Student, 'submissions'>[]).map(student => ({
        ...student,
        submissions: bySession.get(student.id) || [],
      })));
    } catch {
      setLoadError('تعذّر تحديث قائمة التلامذة والنتائج. تحقّق من الاتصال ثم اضغط «تحديث النتائج».');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);
  const realtimeConnection = useRealtimeResults(id, load);

  async function openStudent(student: Student) {
    const client = supabase;
    setSelected(student);
    setModalMessage('');
    setAnswers([]);
    setAudioUrls({});
    setAudioErrors({});
    const submission = student.submissions[0];
    if (!client || !submission) return;
    setLoadingAnswers(true);
    try {
      const { data, error } = await client.from('submissions')
        .select('*,student_answers(*,questions(question_text,points,question_type,answers(id,answer_text,is_correct)))')
        .eq('id', submission.id)
        .single();
      if (error) throw error;
      const items = (data?.student_answers || []) as Answer[];
      setAnswers(items);
      const audioItems = items.filter(item => item.audio_path);
      const signedAudio = await Promise.all(audioItems.map(async item => {
        const { data: signed, error: signError } = await client.storage.from('student-audio').createSignedUrl(item.audio_path!, 3600);
        return { id: item.id, url: signed?.signedUrl, failed: Boolean(signError || !signed?.signedUrl) };
      }));
      setAudioUrls(Object.fromEntries(signedAudio.filter(item => item.url).map(item => [item.id, item.url!])));
      setAudioErrors(Object.fromEntries(signedAudio.filter(item => item.failed).map(item => [item.id, true])));
    } catch {
      setModalMessage('تعذّر تحميل إجابات هذا التلميذ. أغلق النافذة وحدّث النتائج ثم حاول مرة أخرى.');
    } finally {
      setLoadingAnswers(false);
    }
  }

  async function saveGrade(answer: Answer, points: number, feedback: string) {
    if (!supabase || !selected) return;
    const submission = selected.submissions[0];
    if (!submission) return;
    setBusy(true);
    setModalMessage('');
    try {
      const { error } = await supabase.from('student_answers').update({
        awarded_points: points,
        teacher_feedback: feedback,
        review_status: 'reviewed',
      }).eq('id', answer.id);
      if (error) throw error;

      const next = answers.map(item => item.id === answer.id
        ? { ...item, awarded_points: points, teacher_feedback: feedback, review_status: 'reviewed' }
        : item);
      const total = next.reduce((sum, item) => sum + (item.awarded_points || 0), 0);
      const hasPending = next.some(item => item.review_status === 'pending');
      const { error: scoreError } = await supabase.from('submissions').update({
        total_score: total,
        grading_status: hasPending ? 'partial' : 'complete',
      }).eq('id', submission.id);
      if (scoreError) throw scoreError;

      setAnswers(next);
      setModalMessage('تم حفظ الدرجة والملاحظة.');
      await load();
    } catch {
      setModalMessage('تعذّر حفظ التصحيح. تحقّق من اتصال الإنترنت وصلاحيات المشروع ثم حاول مرة أخرى.');
    } finally {
      setBusy(false);
    }
  }

  const visible = students.filter(student => {
    if (filter === 'all') return true;
    if (filter === 'submitted') return student.status === 'submitted';
    if (filter === 'active') return student.status !== 'submitted';
    return student.submissions[0]?.grading_status === 'partial';
  });

  return <main className="editor-page">
    <Link to={`/teacher/quiz/${id}`} className="back-link"><ArrowRight /> العودة للاختبار</Link>
    <div className="editor-heading">
      <div><span className="eyebrow"><Radio /> متابعة المشاركات</span><h1>{quizTitle || 'نتائج الاختبار'}</h1><p>تتحدث القائمة تلقائياً عند انضمام تلميذ أو إرساله الإجابة.</p><span className={`realtime-status ${realtimeConnection}`}>{realtimeConnection === 'connected' ? 'الاتصال المباشر يعمل' : realtimeConnection === 'connecting' ? 'جارٍ الاتصال المباشر…' : 'التحديث المباشر غير متصل؛ استخدم زر تحديث النتائج'}</span></div>
      <div className="heading-actions">
        <div className="stat-card compact-stat"><b>{students.filter(student => student.status === 'submitted').length} / {students.length}</b><small>أرسلوا إجاباتهم</small></div>
        <button className="button light" onClick={() => void load()} disabled={loading} aria-label="تحديث النتائج"><RefreshCw size={18} />{loading ? 'جارٍ التحديث…' : 'تحديث النتائج'}</button>
      </div>
    </div>
    {loadError && <div className="error" role="alert">{loadError}</div>}
    <div className="filter-tabs">{([['all', 'جميع التلامذة'], ['submitted', 'أرسلوا الإجابة'], ['active', 'لم يرسلوا بعد'], ['pending', 'بانتظار التصحيح']] as const).map(([key, label]) => <button className={filter === key ? 'active' : ''} key={key} onClick={() => setFilter(key)}>{label}</button>)}</div>
    {visible.length === 0
      ? <div className="empty-card">{loading ? 'جارٍ تحميل المشاركات…' : 'لا توجد مشاركات في هذا التصنيف بعد.'}</div>
      : <div className="results-list">{visible.map(student => <article className="result-row" key={student.id}>
        <span className="avatar">{student.student_name?.[0] || 'ت'}</span>
        <div className="result-name"><b>{student.student_name}</b><small>{student.status === 'submitted' && student.submissions[0] ? `أرسل الإجابة ${new Date(student.submissions[0].submitted_at).toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' })}` : `انضمّ ${new Date(student.joined_at).toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' })}`}</small></div>
        <span className={`status ${student.status === 'submitted' ? 'published' : 'draft'}`}>{student.status === 'submitted' && student.submissions[0]?.grading_status === 'partial' ? 'بانتظار التصحيح' : student.status === 'submitted' ? 'تم الإرسال' : 'يعمل على الاختبار'}</span>
        {student.submissions[0] && <b>{student.submissions[0].total_score} / {student.submissions[0].maximum_score}</b>}
        <button className="button light" disabled={!student.submissions.length} onClick={() => void openStudent(student)}>عرض الإجابات</button>
      </article>)}</div>}

    {selected && <div className="modal-backdrop" role="presentation" onClick={event => { if (event.target === event.currentTarget) setSelected(null); }}>
      <section className="grading-modal" role="dialog" aria-modal="true" aria-labelledby="grading-title">
        <header><div><span className="eyebrow">مراجعة الإجابات</span><h2 id="grading-title">{selected.student_name}</h2></div><button className="icon-button" aria-label="إغلاق" onClick={() => setSelected(null)}><X /></button></header>
        {modalMessage && <div className={modalMessage.startsWith('تعذّر') ? 'error' : 'notice'} role="status">{modalMessage}</div>}
        {loadingAnswers ? <p>جارٍ تحميل الإجابات والتسجيلات الصوتية…</p> : answers.length === 0 ? <p>لا توجد إجابات مسجلة لهذا الاختبار.</p> : answers.map((answer, index) => <GradeAnswer key={answer.id} item={answer} index={index} audioUrl={audioUrls[answer.id]} audioError={audioErrors[answer.id]} onSave={saveGrade} busy={busy} />)}
      </section>
    </div>}
  </main>;
}

function GradeAnswer({ item, index, audioUrl, audioError, onSave, busy }: {
  item: Answer;
  index: number;
  audioUrl?: string;
  audioError?: boolean;
  onSave: (answer: Answer, points: number, feedback: string) => void;
  busy: boolean;
}) {
  const [points, setPoints] = useState(item.awarded_points ?? 0);
  const [feedback, setFeedback] = useState(item.teacher_feedback || '');
  const typeLabel: Record<string, string> = { multiple_choice: 'اختيار من متعدد', true_false: 'صح أو خطأ', short_text: 'إجابة قصيرة', fill_blank: 'إكمال الفراغ', oral: 'إجابة صوتية', ordering: 'ترتيب' };
  const chosen = (item.selected_answer_ids || []).map(answerId => item.questions.answers?.find(answer => answer.id === answerId)?.answer_text).filter(Boolean).join('، ');

  return <article className="grade-card">
    <div className="grade-question"><span className="question-number">{index + 1}</span><div><b>{item.questions.question_text}</b><small>{typeLabel[item.questions.question_type] || 'إجابة'} · الدرجة الكاملة {item.questions.points}</small></div></div>
    <p className="expected-answer"><b>إجابة التلميذ:</b> {item.audio_path ? 'تسجيل صوتي' : chosen || item.answer_text || 'لم تُرسل إجابة'}</p>
    {item.questions.answers?.some(answer => answer.is_correct) && <p className="expected-answer"><b>الإجابة الصحيحة:</b> {item.questions.answers.filter(answer => answer.is_correct).map(answer => answer.answer_text).join('، ')}</p>}
    {audioUrl && <audio controls preload="none" src={audioUrl}><Headphones /> استمع إلى إجابة التلميذ</audio>}
    {audioError && <p className="error">تعذّر فتح التسجيل الصوتي. تحقّق من سياسة ملفات الصوت في Supabase.</p>}
    {item.questions.question_type === 'oral' && !item.audio_path && <p className="expected-answer">لم يرفق التلميذ تسجيلاً صوتياً.</p>}
    <div className="grade-controls">
      <label>الدرجة المستحقة<input type="number" min="0" max={item.questions.points} step="0.5" value={points} onChange={event => setPoints(Number(event.target.value))} /></label>
      <label>ملاحظة للمعلم<textarea rows={2} value={feedback} onChange={event => setFeedback(event.target.value)} placeholder="اكتب ملاحظة التصحيح" /></label>
      <button className="button primary" disabled={busy} onClick={() => onSave(item, Math.min(item.questions.points, Math.max(0, points)), feedback)}><Save size={17} /> حفظ التصحيح</button>
    </div>
  </article>;
}
