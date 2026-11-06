import { useState } from 'react';
import { Link } from 'react-router-dom';
import { UserRoundPlus } from 'lucide-react';
import { supabase } from '../../services/supabase/client';

function explainSignupError(message: string) {
  const text = message.toLowerCase();
  if (text.includes('already registered') || text.includes('already been registered')) return 'هذا البريد مسجّل من قبل. جرّب تسجيل الدخول بدلاً من إنشاء حساب جديد.';
  if (text.includes('signup is disabled') || text.includes('signups not allowed') || text.includes('new user signups are disabled')) return 'التسجيل مغلق في إعدادات Supabase. فعّل السماح للمستخدمين الجدد بالتسجيل.';
  if (text.includes('invalid email') || text.includes('email address')) return 'تحقّق من كتابة البريد الإلكتروني بشكل صحيح.';
  if (text.includes('password') && (text.includes('weak') || text.includes('short') || text.includes('least'))) return 'كلمة المرور لا تحقق الحد المطلوب. استخدم كلمة مرور أقوى من ثمانية أحرف.';
  if (text.includes('rate limit') || text.includes('security purposes')) return 'أُرسلت طلبات كثيرة خلال وقت قصير. انتظر قليلاً ثم حاول مرة أخرى.';
  if (text.includes('database error') || text.includes('saving new user')) return 'تعذّر حفظ الحساب في قاعدة البيانات. تحقّق من تشغيل ملفات SQL، ثم راجع سجل المصادقة في Supabase.';
  if (text.includes('failed to fetch') || text.includes('network') || text.includes('fetch')) return 'تعذّر الاتصال بـ Supabase. تحقّق من رابط المشروع والمفتاح العام في إعدادات التطبيق ومن اتصال الإنترنت.';
  return 'تعذّر إنشاء الحساب من خدمة المصادقة. افتح Supabase ثم Authentication ← Audit Logs، وأرسل نص آخر خطأ ظاهر هناك.';
}

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setMessage('');
    setIsError(false);
    if (!supabase) {
      setMessage('أضف إعدادات قاعدة البيانات لتفعيل إنشاء الحساب.');
      setIsError(true);
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name } } });
      if (error) {
        setMessage(explainSignupError(error.message));
        setIsError(true);
      } else {
        setMessage('تم إنشاء الحساب. تحقّق من بريدك الإلكتروني واضغط رابط التأكيد قبل تسجيل الدخول.');
      }
    } catch {
      setMessage('تعذّر الاتصال بخدمة التسجيل. تحقّق من اتصال الإنترنت ثم حاول مرة أخرى.');
      setIsError(true);
    } finally {
      setBusy(false);
    }
  }

  return <main className="form-page"><section className="form-card">
    <span className="feature-icon green"><UserRoundPlus /></span>
    <h1>ابدأ رحلتك التعليمية</h1>
    <p>أنشئ حساباً للمعلم واحفظ اختباراتك بأمان.</p>
    <form onSubmit={submit}>
      <label>الاسم الكامل<input required value={name} onChange={event => setName(event.target.value)} placeholder="مثال: أمل محمد" /></label>
      <label>البريد الإلكتروني<input required type="email" value={email} onChange={event => setEmail(event.target.value)} dir="ltr" /></label>
      <label>كلمة المرور<input required minLength={8} type="password" value={password} onChange={event => setPassword(event.target.value)} /><small>ثمانية أحرف على الأقل.</small></label>
      {message && <div className={isError ? 'error' : 'notice'} role="status">{message}</div>}
      <button className="button primary full" disabled={busy}>{busy ? 'جارٍ إنشاء الحساب…' : 'إنشاء حساب المعلم'}</button>
    </form>
    <p className="form-bottom">لديك حساب؟ <Link to="/login">تسجيل الدخول</Link></p>
  </section></main>;
}
