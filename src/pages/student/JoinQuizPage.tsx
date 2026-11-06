import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, GraduationCap } from 'lucide-react';
import { lookupQuiz } from '../../services/quizService';
import { supabase } from '../../services/supabase/client';

type PublicQuiz = { id: string; title: string; description: string | null; subject: string | null };

function messageFrom(error: unknown) {
  if (!error || typeof error !== 'object' || !('message' in error)) return '';
  return String(error.message).toLowerCase();
}

export default function JoinQuizPage() {
  const { code: routeCode } = useParams();
  const [code, setCode] = useState(routeCode?.toUpperCase() || '');
  const [quiz, setQuiz] = useState<PublicQuiz | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function find(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    if (!supabase) {
      setError('يلزم الاتصال بالإنترنت للدخول إلى الاختبار.');
      return;
    }
    setBusy(true);
    try {
      const result = await lookupQuiz(code.trim().toUpperCase());
      if (!result) setError('لم نعثر على اختبار بهذا الرمز. تحقّق منه وحاول مرة أخرى.');
      else setQuiz((Array.isArray(result) ? result[0] : result) as PublicQuiz);
    } catch {
      setError('تعذّر العثور على الاختبار. تحقّق من الرمز واتصال الإنترنت.');
    } finally {
      setBusy(false);
    }
  }

  async function join(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError('');
    try {
      let { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        const { data, error: authError } = await supabase.auth.signInAnonymously();
        if (authError || !data.user) throw authError || new Error('Anonymous sign-in failed');
        user = data.user;
      }
      const { data, error: joinError } = await supabase.rpc('join_quiz', {
        quiz_code: code.trim().toUpperCase(),
        display_name: name.trim(),
      });
      if (joinError) throw joinError;
      navigate(`/take/${data}`);
    } catch (joinError) {
      const detail = messageFrom(joinError);
      setError(detail.includes('attempt already submitted')
        ? 'سبق أن أرسلت إجابتك لهذا الاختبار. لا يسمح الاختبار بمحاولة ثانية من الحساب نفسه.'
        : 'تعذّر بدء الاختبار. تحقّق من الاتصال ثم حاول مرة أخرى.');
    } finally {
      setBusy(false);
    }
  }

  return <main className="form-page"><section className="form-card join-card">
    <span className="feature-icon green"><GraduationCap /></span>
    {!quiz ? <>
      <h1>الدخول إلى اختبار</h1>
      <p>أدخل الرمز الذي أرسله المعلم.</p>
      <form onSubmit={find}>
        <label>رمز الاختبار<input className="code-input" type="text" inputMode="text" autoCapitalize="characters" maxLength={12} value={code} onChange={event => setCode(event.target.value.toUpperCase().replace(/[^0-9A-F]/g, '').slice(0, 12))} placeholder="مثال: 4A82F61C09B3" required /></label>
        {error && <div className="error" role="alert">{error}</div>}
        <button className="button primary full" disabled={busy}>{busy ? 'جارٍ البحث…' : 'متابعة'}</button>
      </form>
    </> : <>
      <span className="eyebrow">الاختبار جاهز</span>
      <h1>{quiz.title}</h1>
      <p>{quiz.description || 'أدخل اسمك للبدء. ستبقى إجاباتك خاصة.'}</p>
      <form onSubmit={join}>
        <label>اسم التلميذ<input required maxLength={80} value={name} onChange={event => setName(event.target.value)} placeholder="اكتب اسمك هنا" /></label>
        {error && <div className="error" role="alert">{error}</div>}
        <button className="button primary full" disabled={busy}>{busy ? 'جارٍ البدء…' : 'ابدأ الاختبار'} <ArrowLeft size={18} /></button>
      </form>
    </>}
  </section></main>;
}
