/** Injects reader URL at request time from READER_BASE_URL (not baked at build). */
export default function ReaderBaseUrlScript() {
  const readerBaseUrl =
    process.env.READER_BASE_URL ||
    process.env.NEXT_PUBLIC_READER_URL ||
    'https://reader.vidhyavibe.in';

  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `window.__READER_BASE_URL__=${JSON.stringify(readerBaseUrl.replace(/\/$/, ''))};`,
      }}
    />
  );
}
