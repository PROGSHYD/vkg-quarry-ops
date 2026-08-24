export const runtime = 'edge';
export const metadata = {
  title: 'VKG Quarry Ops',
  description: 'Quarry Operations Monitoring',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#0D0F14', color: '#EDEEF2', fontFamily: 'Manrope, sans-serif' }}>
        {children}
      </body>
    </html>
  );
}
