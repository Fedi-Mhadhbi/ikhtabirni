import { useEffect, useState } from 'react';
import { supabase } from '../services/supabase/client';

export type ResultsConnection = 'connecting' | 'connected' | 'disconnected';

export function useRealtimeResults(quizId: string | undefined, onChange: () => void) {
  const [connection, setConnection] = useState<ResultsConnection>('connecting');

  useEffect(() => {
    const client = supabase;
    if (!client || !quizId) {
      setConnection('disconnected');
      return;
    }

    setConnection('connecting');
    const channel = client.channel(`quiz-monitor-${quizId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quiz_sessions', filter: `quiz_id=eq.${quizId}` }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'submissions', filter: `quiz_id=eq.${quizId}` }, onChange)
      .subscribe(status => {
        setConnection(status === 'SUBSCRIBED' ? 'connected' : status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED' ? 'disconnected' : 'connecting');
      });

    return () => {
      setConnection('disconnected');
      void client.removeChannel(channel);
    };
  }, [quizId, onChange]);

  return connection;
}
