"use client";

import type { ContentBlock } from "@/app/actions";

interface ContentBlockRendererProps {
  blocks: ContentBlock[];
}

const Heading = ({ level, content }: { level: number; content: string }) => {
  const Tag = `h${level + 1}` as keyof JSX.IntrinsicElements; // h1, h2, h3 -> h2, h3, h4
  return <Tag className="font-headline text-xl font-bold mt-6 mb-2 text-foreground first-of-type:mt-0">{content}</Tag>;
};

const Paragraph = ({ content }: { content: string }) => {
  return <p className="text-base text-foreground/90 leading-relaxed mb-4">{content}</p>;
};

const List = ({ items }: { items: string[] }) => {
  return (
    <ul className="list-disc list-outside pl-5 space-y-2 text-base text-foreground/90 leading-relaxed">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
};


export default function ContentBlockRenderer({ blocks }: ContentBlockRendererProps) {
    if (!blocks || blocks.length === 0) {
        return null;
    }

  return (
    <div className="w-full">
      {blocks.map((block, index) => {
        switch (block.type) {
          case "heading":
            return <Heading key={index} level={block.level} content={block.content} />;
          case "paragraph":
            return <Paragraph key={index} content={block.content} />;
          case "list":
            return <List key={index} items={block.items} />;
          default:
            return null;
        }
      })}
    </div>
  );
}
