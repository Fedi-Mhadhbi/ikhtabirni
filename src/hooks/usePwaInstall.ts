import { useEffect, useState } from 'react';

type InstallChoice = { outcome: 'accepted' | 'dismissed'; platform: string };
type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<InstallChoice>;
};

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
}

export function usePwaInstall() {
  const [promptEvent, setPromptEvent] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    setInstalled(isStandalone());
    const beforeInstall = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPrompt);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
      setMessage('تم تثبيت التطبيق على جهازك.');
    };
    window.addEventListener('beforeinstallprompt', beforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', beforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  async function install() {
    setMessage('');
    if (installed) return;
    if (promptEvent) {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      setPromptEvent(null);
      if (choice.outcome === 'accepted') setMessage('وافقت على التثبيت. سيظهر التطبيق على جهازك بعد اكتمال العملية.');
      else setMessage('لم يكتمل التثبيت. يمكنك المحاولة مرة أخرى من زر التثبيت.');
      return;
    }

    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setMessage(isIos
      ? 'على الآيفون أو الآيباد: اضغط «مشاركة» في المتصفح، ثم اختر «إضافة إلى الشاشة الرئيسية». '
      : 'افتح قائمة المتصفح ⋮ ثم اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية». إذا لم يظهر الخيار، حدّث الصفحة وتأكد من اتصال الإنترنت.');
  }

  return { install, installed, message };
}
