import { useState, type FormEvent } from 'react';
import { Section } from './fields';

interface ChatSectionProps {
  /** Resolves to the answer, or null when the form is not valid yet. Throws on a failed request. */
  ask: (question: string) => Promise<string | null>;
  onError: (message: string) => void;
}

export function ChatSection({ ask, onError }: ChatSectionProps) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [asking, setAsking] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const text = question.trim();
    if (!text) return;
    setAsking(true);
    try {
      const reply = await ask(text);
      if (reply !== null) setAnswer(reply);
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setAsking(false);
    }
  }

  return (
    <Section title="Ask a follow-up question">
      <form onSubmit={onSubmit} className="ask">
        <label htmlFor="question">For example: which mask should I buy, or when should the children play outside?</label>
        <input id="question" value={question} maxLength={500} onChange={(e) => setQuestion(e.target.value)} />
        <button type="submit" disabled={asking || !question.trim()}>
          {asking ? 'Thinking…' : 'Ask'}
        </button>
      </form>
      <div aria-live="polite">{answer && <p className="answer">{answer}</p>}</div>
    </Section>
  );
}
