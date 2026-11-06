import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, BookOpenCheck, ClipboardList, Copy, Plus, Radio, Trash2, UsersRound } from 'lucide-react';
import { duplicateQuiz, listQuizzes, removeQuiz, type Quiz } from '../../services/quizService';
import { useAuth } from '../../hooks/useAuth';

export default function DashboardPage() {
  const { user } = useAuth();
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  async function refresh() {
    try { setQuizzes(await listQuizzes()); setError(''); }
    catch { setError('تعذّر تحميل الاختبارات. سجّلي الدخول وتأكدي من إعداد الاتصال.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void refresh(); }, []);
  async function remove(quiz: Quiz) {
    if (!confirm(`هل تريدين حذف اختبار «${quiz.title}»؟ لا يمكن التراجع عن هذا الإجراء.`)) return;
    try { await removeQuiz(quiz.id); await refresh(); }
    catch { setError('تعذّر حذف الاختبار.'); }
  }
  async function duplicate(id:string){try{await duplicateQuiz(id);await refresh()}catch{setError('تعذّر إنشاء نسخة من الاختبار.');}}
  return <main className="dashboard"><aside className="side-nav"><Link className="side-active" to="/teacher"><ClipboardList/> اختباراتي</Link><Link to="/teacher/create"><Plus/> إنشاء اختبار</Link><Link to="/join"><UsersRound/> دخول التلامذة</Link></aside><section className="dash-main"><div className="page-heading"><div><span className="eyebrow">مساحة المعلمة</span><h1>أهلاً {user?.user_metadata.full_name || 'بكِ'}، كيف نبدأ؟</h1><p>هنا تجدين اختباراتك وتتابعين تقدّم تلامذتك.</p></div><Link className="button primary" to="/teacher/create"><Plus/> إنشاء اختبار</Link></div><div className="stat-grid"><article className="stat-card"><span className="feature-icon green"><BookOpenCheck/></span><div><small>مجموع الاختبارات</small><strong>{quizzes.length}</strong></div></article><article className="stat-card"><span className="feature-icon gold"><Radio/></span><div><small>اختبارات منشورة</small><strong>{quizzes.filter(q => q.status === 'published').length}</strong></div></article><article className="stat-card"><span className="feature-icon lavender"><UsersRound/></span><div><small>إجمالي المشاركات</small><strong>{quizzes.reduce((n, q) => n + (q.quiz_sessions?.length || 0), 0)}</strong></div></article></div><div className="list-heading"><div><h2>اختباراتك</h2><p>كل موادك واختباراتك في مكان واحد.</p></div></div>{error && <div className="error">{error}</div>}{loading ? <div className="empty-card">جارٍ تحميل الاختبارات…</div> : quizzes.length === 0 ? <div className="empty-card"><span className="feature-icon green"><ClipboardList/></span><h3>لم تنشئي اختباراً بعد</h3><p>ابدئي باختبار قصير، ثم شاركيه مع تلامذتك عندما يصبح جاهزاً.</p><Link className="button primary" to="/teacher/create">إنشاء أول اختبار</Link></div> : <div className="quiz-grid">{quizzes.map(q => <article className="quiz-card" key={q.id}><div className="quiz-top"><span className={`status ${q.status}`}>{q.status === 'published' ? 'منشور' : q.status === 'closed' ? 'مغلق' : 'مسودة'}</span><div className="quiz-tools"><button className="icon-button" aria-label="نسخ الاختبار" title="نسخ الاختبار" onClick={() => void duplicate(q.id)}><Copy size={17}/></button><button className="icon-button danger" aria-label="حذف الاختبار" onClick={() => void remove(q)}><Trash2 size={18}/></button></div></div><h3>{q.title}</h3><p>{q.subject || 'دون مادة محددة'}</p><div className="quiz-meta"><span>{q.questions?.length || 0} سؤال</span><span>{q.quiz_sessions?.length || 0} مشاركة</span><span>{new Date(q.created_at).toLocaleDateString('ar')}</span></div><div className="quiz-actions"><Link to={`/teacher/quiz/${q.id}`}>إدارة الاختبار <ArrowLeft size={16}/></Link>{q.status === 'published' && <Link to={`/teacher/quiz/${q.id}/results`}>متابعة النتائج</Link>}</div></article>)}</div>}</section></main>;
}
