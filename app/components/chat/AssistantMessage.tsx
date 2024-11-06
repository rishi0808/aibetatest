import { memo } from 'react';
import { Markdown } from './Markdown';

interface AssistantMessageProps {
  content: string;
}

export const AssistantMessage = memo(({ content }: AssistantMessageProps) => {
  return (
    <div 
      className="overflow-hidden w-full animate-in fade-in slide-in-from-bottom-2 duration-300"
    >
      <div className="relative">
        <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#00e5ff] opacity-30 rounded-full" />
        <div className="pl-4">
          <Markdown html>{content}</Markdown>
        </div>
        <div 
          className="absolute inset-0 bg-gradient-to-r from-transparent via-[rgba(0,229,255,0.05)] to-transparent -z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{
            maskImage: 'linear-gradient(to right, transparent, white 20%, white 80%, transparent)',
            WebkitMaskImage: 'linear-gradient(to right, transparent, white 20%, white 80%, transparent)'
          }}
        />
      </div>
    </div>
  );
});
