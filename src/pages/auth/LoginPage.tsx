import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Download, LogIn } from 'lucide-react';
import { supabase } from '../../services/supabase/client';
import { usePwaInstall } from '../../hooks/usePwaInstall';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { install, installed, message: installMessage } = usePwaInstall();
  const navigate = useNavigate();

  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    if (!supabase) {
      setError('أضف إعدادات قاعدة البيانات لتفعيل تسجيل الدخول.');
      return;
    }
    setBusy(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (signInError) setError('تعذّر تسجيل الدخول. تحقّق من البريد وكلمة المرور.');
    else navigate('/teacher');
  }

  return <main className="form-page">
    <section className="form-card">
      <span className="feature-icon green"><LogIn /></span>
      <h1>مرحباً بعودتك</h1>
      <p>سجّل الدخول لمتابعة اختباراتك.</p>
      <form onSubmit={signIn}>
        <label>البريد الإلكتروني<input type="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="name@example.com" dir="ltr" /></label>
        <label>كلمة المرور<input type="password" required value={password} onChange={event => setPassword(event.target.value)} /></label>
        {error && <div className="error" role="alert">{error}</div>}
        <button className="button primary full" disabled={busy}>{busy ? 'جارٍ الدخول…' : 'تسجيل الدخول'}</button>
      </form>
      <div className="install-section">
        {!installed && <button className="button install-button full" type="button" onClick={() => void install()}><Download size={19} /> تثبيت التطبيق على الجهاز</button>}
        {installed && <div className="notice install-notice">التطبيق مثبت على هذا الجهاز.</div>}
        {installMessage && <p className="install-help" role="status">{installMessage}</p>}
      </div>
      <p className="form-bottom">ليس لديك حساب؟ <Link to="/register">أنشئ حساباً جديداً</Link></p>
    </section>
  </main>;
}
