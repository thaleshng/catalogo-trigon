import React from 'react';

interface FormattedTextProps {
  text?: string | null;
  className?: string;
  strongClassName?: string;
}

/**
 * Renderiza textos preservando quebras de linha e formatando marcações comuns de texto:
 * - Negrito WhatsApp: *texto*
 * - Negrito Markdown: **texto**
 * - Itálico WhatsApp/Markdown: _texto_
 * - Riscado: ~texto~
 * - Destaque em linha (código): `texto`
 */
export const FormattedText: React.FC<FormattedTextProps> = ({
  text,
  className = '',
  strongClassName = 'font-semibold text-white',
}) => {
  if (!text) return null;

  const lines = text.split('\n');

  return (
    <span className={className}>
      {lines.map((line, lineIndex) => (
        <React.Fragment key={lineIndex}>
          {lineIndex > 0 && <br />}
          {parseLine(line, strongClassName)}
        </React.Fragment>
      ))}
    </span>
  );
};

function parseLine(line: string, strongClassName: string): React.ReactNode[] {
  if (!line) return [];

  // Captura marcações suportadas:
  // 1. **negrito** (Markdown)
  // 2. *negrito* (WhatsApp - lookahead/lookbehind para não capturar asterisco solto tipo "* item")
  // 3. _itálico_
  // 4. ~riscado~
  // 5. `código/destaque`
  const regex = /(\*\*[^*\r\n]+?\*\*|\*(?!\s)[^*\r\n]+?(?<!\s)\*|_(?!\s)[^_\r\n]+?(?<!\s)_|~(?!\s)[^~\r\n]+?(?<!\s)~|`[^`\r\n]+?`)/g;

  const parts = line.split(regex);

  return parts.map((part, index) => {
    if (!part) return null;

    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={index} className={strongClassName}>
          {part.slice(2, -2)}
        </strong>
      );
    }

    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return (
        <strong key={index} className={strongClassName}>
          {part.slice(1, -1)}
        </strong>
      );
    }

    if (part.startsWith('_') && part.endsWith('_') && part.length > 2) {
      return (
        <em key={index} className="italic text-trigon-100">
          {part.slice(1, -1)}
        </em>
      );
    }

    if (part.startsWith('~') && part.endsWith('~') && part.length > 2) {
      return (
        <s key={index} className="line-through text-trigon-400">
          {part.slice(1, -1)}
        </s>
      );
    }

    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code
          key={index}
          className="px-1.5 py-0.5 rounded bg-trigon-800 text-amber-300 font-mono text-[0.9em]"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
}

export default FormattedText;
