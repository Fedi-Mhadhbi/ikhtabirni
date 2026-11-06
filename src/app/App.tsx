import { useEffect, useState } from 'react';
import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { BookOpenCheck, GraduationCap, LayoutDashboard, LogIn, Plus, ShieldCheck } from 'lucide-react';
import { supabaseReady } from '../services/supabase/client';
import { useAuth } from '../hooks/useAuth';
import HomePage from '../pages/HomePage';
import LoginPage from '../pages/auth/LoginPage';
import RegisterPage from '../pages/auth/RegisterPage';
import DashboardPage from '../pages/teacher/DashboardPage';
import CreateQuizPage from '../pages/teacher/CreateQuizPage';
import JoinQuizPage from '../pages/student/JoinQuizPage';
import TakeQuizPage from '../pages/student/TakeQuizPage';
import CompletedPage from '../pages/student/CompletedPage';
import QuizDetailsPage from '../pages/teacher/QuizDetailsPage';
import ResultsPage from '../pages/teacher/ResultsPage';

function TeacherOnly({children}:{children:React.ReactNode}){const{user,loading}=useAuth();if(loading)return <main className="form-page"><section className="form-card">جارٍ التحقق من الحساب…</section></main>;return user&&!user.is_anonymous?children:<Navigate to="/login" replace/>;}
export default function App(){
 const{user,signOut}=useAuth();const[menu,setMenu]=useState(false);const[offline,setOffline]=useState(!navigator.onLine);useEffect(()=>{const online=()=>setOffline(false),offlineEvent=()=>setOffline(true);window.addEventListener('online',online);window.addEventListener('offline',offlineEvent);return()=>{window.removeEventListener('online',online);window.removeEventListener('offline',offlineEvent)}},[]);
 return <><header className="topbar"><Link to="/" className="brand"><span className="brand-mark"><BookOpenCheck size={23}/></span><span>اختبرني<small>نتعلّم بثقة</small></span></Link><button className="menu-toggle" onClick={()=>setMenu(!menu)} aria-label="القائمة">☰</button><nav className={menu?'nav open':'nav'}><Link to="/join"><GraduationCap size={18}/> دخول التلامذة</Link>{user&&!user.is_anonymous?<><Link to="/teacher"><LayoutDashboard size={18}/> لوحة المعلمة</Link><Link to="/teacher/create"><Plus size={18}/> اختبار جديد</Link><button className="nav-action" onClick={()=>void signOut()}>تسجيل الخروج</button></>:<><Link to="/login"><LogIn size={18}/> دخول المعلمة</Link><Link className="nav-cta" to="/register">ابدئي الآن</Link></>}</nav></header>{!supabaseReady&&<div className="setup-note"><ShieldCheck size={17}/> لتفعيل الحسابات والاختبارات المباشرة أضيفي إعدادات مشروع قاعدة البيانات.</div>}{offline&&<div className="setup-note offline-note"><ShieldCheck size={17}/> أنتِ دون اتصال. يلزم الإنترنت لتسجيل الدخول والانضمام وإرسال الإجابات ومتابعة النتائج.</div>}<Routes><Route path="/" element={<HomePage/>}/><Route path="/login" element={<LoginPage/>}/><Route path="/register" element={<RegisterPage/>}/><Route path="/teacher" element={<TeacherOnly><DashboardPage/></TeacherOnly>}/><Route path="/teacher/create" element={<TeacherOnly><CreateQuizPage/></TeacherOnly>}/><Route path="/teacher/quiz/:id" element={<TeacherOnly><QuizDetailsPage/></TeacherOnly>}/><Route path="/teacher/quiz/:id/results" element={<TeacherOnly><ResultsPage/></TeacherOnly>}/><Route path="/join" element={<JoinQuizPage/>}/><Route path="/join/:code" element={<JoinQuizPage/>}/><Route path="/take/:sessionId" element={<TakeQuizPage/>}/><Route path="/completed" element={<CompletedPage/>}/><Route path="*" element={<HomePage/>}/></Routes><footer><span>اختبرني © {new Date().getFullYear()}</span><span>مساحة آمنة للتعلّم والإنجاز</span></footer></>;
}
