import type { ReactNode } from 'react';

interface ScreenProps {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}

/** Common page frame: large title + content, sized for one-handed phone use. */
export function Screen({ title, children, actions }: ScreenProps) {
  return (
    <section className="screen">
      <header className="screen__header">
        <h1 className="screen__title">{title}</h1>
        {actions}
      </header>
      {children}
    </section>
  );
}
