import { Card, CardHeader } from '@ui5/webcomponents-react';
import ReactMarkdown from 'react-markdown';
import type { Artifact, Part } from '../../services/a2a/types.ts';

interface ArtifactRendererProps {
  artifact: Artifact;
}

function renderArtifactPart(part: Part, index: number) {
  switch (part.kind) {
    case 'text':
      return (
        <div key={index} style={{ padding: '0.5rem' }}>
          <ReactMarkdown>{part.text}</ReactMarkdown>
        </div>
      );
    case 'file':
      return (
        <div key={index} style={{ padding: '0.5rem' }}>
          {part.file.url ? (
            <a
              href={part.file.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--sapLinkColor)' }}
            >
              {part.file.name ?? 'Download'}
            </a>
          ) : (
            <span>{part.file.name ?? 'Embedded file'}</span>
          )}
        </div>
      );
    case 'data':
      return (
        <pre
          key={index}
          style={{
            background: 'var(--sapField_Background)',
            padding: '0.75rem',
            margin: '0.5rem',
            borderRadius: '4px',
            overflow: 'auto',
            fontSize: '0.8125rem',
          }}
        >
          {JSON.stringify(part.data, null, 2)}
        </pre>
      );
  }
}

export function ArtifactRenderer({ artifact }: ArtifactRendererProps) {
  return (
    <Card
      header={
        <CardHeader
          titleText={artifact.name ?? 'Artifact'}
          subtitleText={artifact.description}
        />
      }
    >
      {artifact.parts.map((part, i) => renderArtifactPart(part, i))}
    </Card>
  );
}
