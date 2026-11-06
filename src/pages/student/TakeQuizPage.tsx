import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Mic, MicOff, Send } from 'lucide-react';
import { supabase } from '../../services/supabase/client';
import { startRecording } from '../../services/audio/recorder';

type Question = { id:string; question_text:string; question_type:string; points:number; teacher_audio_path:string|null; audio_url?:string; answers:{id:string;answer_text:string}[] };
type QuizSession = { title:string; student_name:string; questions:Question[] };

export default function TakeQuizPage() {
  // The route is /take/:sessionId. Read that exact parameter so a student
  // who joins successfully can load the session-specific quiz.
  const { sessionId: id } = useParams(); const navigate = useNavigate();
  const [quiz,setQuiz]=useState<QuizSession|null>(null); const [index,setIndex]=useState(0);
  const [answers,setAnswers]=useState<Record<string,string[]>>(()=>{try{return JSON.parse(localStorage.getItem(`ikhtabirni-answers-${id}`)||'{}')}catch{return{}}}); const [error,setError]=useState(''); const [busy,setBusy]=useState(false);const[recording,setRecording]=useState<{stop:()=>void}|null>(null);const[previewUrl,setPreviewUrl]=useState('');
  useEffect(()=>{ let active=true; async function load(){
    if(!supabase||!id){setError('رابط الاختبار غير مكتمل.');return;}
    const {data,error}=await supabase.rpc('session_quiz',{session_id:id});
    if(error||!data){setError('لم نتمكن من فتح هذا الاختبار.');return;}
    const session=data as QuizSession;
    for(const question of session.questions){if(question.teacher_audio_path){const{data:audio}=await supabase.storage.from('teacher-audio').createSignedUrl(question.teacher_audio_path,3600);if(audio)question.audio_url=audio.signedUrl;}}
    if(active)setQuiz(session);
  } void load(); return()=>{active=false}; },[id]);
  if(error)return <main className="form-page"><section className="form-card"><div className="error">{error}</div><button className="button light" onClick={()=>navigate('/join')}>العودة للدخول</button></section></main>;
  if(!quiz)return <main className="form-page"><section className="form-card">جارٍ تحميل الاختبار…</section></main>;
  const questions=quiz.questions; const question=questions[index];
  if(!question)return <main className="form-page"><section className="form-card">لا يحتوي هذا الاختبار على أسئلة بعد.</section></main>;
  const selected=answers[question.id]||[];
  function updateAnswers(change:(old:Record<string,string[]>)=>Record<string,string[]>){setAnswers(old=>{const next=change(old);try{localStorage.setItem(`ikhtabirni-answers-${id}`,JSON.stringify(next))}catch{/* حفظ الإجابة داخل الصفحة يظل متاحاً */}return next;});}
  function choose(value:string){updateAnswers(old=>({...old,[question.id]:[value]}));}
  async function submit(){
    if(!supabase||!id)return;
    if(!confirm('هل أنت متأكدة من إرسال إجاباتك؟ لن تتمكني من تعديلها بعد الإرسال.'))return;
    setBusy(true);
    try{
      const payload=questions.map(q=>({question_id:q.id,answer_text:q.question_type==='oral'?'':(answers[q.id]?.[0]||''),selected_answer_ids:q.question_type==='multiple_choice'||q.question_type==='true_false'?answers[q.id]||[]:[],audio_path:q.question_type==='oral'?answers[q.id]?.[0]?.replace(/^audio:/,'')||null:null}));
      const{error}=await supabase.rpc('submit_quiz',{session_id:id,answer_payload:payload});if(error)throw error;try{localStorage.removeItem(`ikhtabirni-answers-${id}`)}catch{/* تجاهل تعذّر مسح التخزين المحلي */}navigate('/completed');
    }catch{setError('تعذّر إرسال الإجابات. تحقّق من اتصال الإنترنت وحاول مجدداً.');}finally{setBusy(false);}
  }
  async function uploadAudio(file:File){
    if(!supabase||!id)return;
    setBusy(true);setError('');
    try{const{data:{user}}=await supabase.auth.getUser();if(!user)throw new Error();const extension=file.name.split('.').pop()?.replace(/[^a-z0-9]/gi,'')||'webm';const path=`${user.id}/${id}/${question.id}-${crypto.randomUUID()}.${extension}`;const{error}=await supabase.storage.from('student-audio').upload(path,file,{contentType:file.type||'audio/webm'});if(error)throw error;updateAnswers(old=>({...old,[question.id]:[`audio:${path}`]}));}
    catch{setError('تعذّر حفظ التسجيل الصوتي. تحقّق من الاتصال وإذن الميكروفون.');}finally{setBusy(false);}
  }
  async function beginRecording(){try{const control=await startRecording(blob=>{const file=new File([blob],`answer.${blob.type.includes('mp4')?'mp4':'webm'}`,{type:blob.type});const url=URL.createObjectURL(blob);setPreviewUrl(url);void uploadAudio(file);});setRecording({stop:control.stop});setError('');}catch{setError('لم نتمكن من الوصول إلى الميكروفون. تحقّق من إذن التسجيل في المتصفح.');}}
  const uploadedAudio=selected[0]?.startsWith('audio:')?selected[0].slice(6):null;
  return <main className="take-page"><header className="take-header"><span className="brand-mark"><Check/></span><div><b>{quiz.title}</b><small>{quiz.student_name}</small></div></header><div className="take-progress"><span>السؤال {index+1} من {questions.length}</span><span>{Math.round((index+1)/questions.length*100)}٪</span><div className="progress"><i style={{width:`${(index+1)/questions.length*100}%`}}/></div></div><section className="take-card"><span className="eyebrow">السؤال {index+1}</span><h1>{question.question_text}</h1>{question.audio_url&&<audio className="question-audio" controls src={question.audio_url}>المتصفح لا يدعم تشغيل الصوت.</audio>}{question.question_type==='multiple_choice'||question.question_type==='true_false'?<div className="choice-list">{question.answers?.map(answer=><button className={`choice ${selected.includes(answer.id)?'chosen':''}`} key={answer.id} onClick={()=>choose(answer.id)}><span className="radio-dot"/>{answer.answer_text}</button>)}</div>:question.question_type==='oral'?<div className="oral-panel"><p>سجّل إجابتك الصوتية، ثم استمع إليها قبل الإرسال.</p>{recording?<button className="button danger-button" onClick={()=>{recording.stop();setRecording(null)}}><MicOff/> إيقاف التسجيل</button>:<button className="button primary" disabled={busy} onClick={()=>void beginRecording()}><Mic/> بدء التسجيل</button>}{previewUrl&&<audio className="question-audio" controls src={previewUrl}/> }<label>أو اختر تسجيلاً من جهازك<input type="file" accept="audio/*" aria-label="اختيار تسجيل صوتي" disabled={busy} onChange={e=>{const file=e.target.files?.[0];if(file)void uploadAudio(file)}}/></label>{uploadedAudio&&<div className="notice">تم حفظ التسجيل ويمكنك الآن إرسال الإجابة.</div>}</div>:<textarea className="student-answer" rows={4} value={selected[0]||''} onChange={e=>choose(e.target.value)} placeholder="اكتب إجابتك هنا"/>}</section>{error&&<div className="error">{error}</div>}<div className="take-actions"><button className="button light" disabled={index===0||busy||Boolean(recording)} onClick={()=>setIndex(index-1)}><ArrowRight/> السابق</button>{index<questions.length-1?<button className="button primary" onClick={()=>setIndex(index+1)} disabled={busy||Boolean(recording)}>التالي <ArrowLeft/></button>:<button className="button primary" onClick={()=>void submit()} disabled={busy||Boolean(recording)}><Send/>{busy?'جارٍ الإرسال…':'إرسال الإجابات'}</button>}</div></main>;
}
