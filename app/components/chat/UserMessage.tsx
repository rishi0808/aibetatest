import { modificationsRegex } from '~/utils/diff';
import { Markdown } from './Markdown';

interface UserMessageProps {
  content: string;
}

export function UserMessage({ content }: UserMessageProps) {
  return (
    <div 
      className="overflow-hidden pt-[4px] animate-in fade-in slide-in-from-bottom-2 duration-300"
    >
      <div className="relative">
        <Markdown limitedMarkdown>{sanitizeUserMessage(content)}</Markdown>
        <div 
          className="absolute inset-0 bg-gradient-to-r from-transparent via-[rgba(0,229,255,0.1)] to-transparent -z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{
            maskImage: 'linear-gradient(to right, transparent, white 20%, white 80%, transparent)',
            WebkitMaskImage: 'linear-gradient(to right, transparent, white 20%, white 80%, transparent)'
          }}
        />
      </div>
    </div>
  );
}

function sanitizeUserMessage(content: string) {
  // Ensure we have content before trimming
  if (!content) return '';
  
  // Remove any file modification markers and clean up whitespace
  const sanitized = content.replace(modificationsRegex, '').trim();
  
  // Ensure we always return a string, even if empty
  return sanitized || '';
}
