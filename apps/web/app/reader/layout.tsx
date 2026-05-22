import React from 'react';

/** Reader route: tighter layout on phones (footer hidden via globals). */
export default function ReaderLayout({ children }: { children: React.ReactNode }) {
  return <div className="reader-route">{children}</div>;
}
