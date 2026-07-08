
import type { Metadata } from 'next';
import './globals.css';
import { getGeneralSettings } from '@/lib/data.actions';

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getGeneralSettings();
  const favicon = settings?.faviconUrl || '/favicon.ico';
  const siteName = settings?.siteName || 'SnapReels';
  
  return {
    title: settings?.seoTitle || siteName,
    description: settings?.seoDescription || 'Explore a Universe of Drama.',
    keywords: settings?.seoKeywords || 'drama, movies, reels, streaming',
    manifest: '/manifest.webmanifest',
    icons: {
        icon: [
            { url: favicon },
            { url: favicon, sizes: '32x32', type: 'image/png' },
            { url: favicon, sizes: '16x16', type: 'image/png' },
        ],
        apple: [
            { url: favicon, sizes: '180x180', type: 'image/png' },
        ],
        shortcut: [favicon],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
       <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="theme-color" content="#f857a6" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
      </head>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if (typeof Node === 'function' && Node.prototype) {
                const originalRemoveChild = Node.prototype.removeChild;
                Node.prototype.removeChild = function(child) {
                  if (child.parentNode !== this) {
                    if (console) {
                      console.warn('Cannot remove a child from a different parent', child, this);
                    }
                    return child;
                  }
                  return originalRemoveChild.apply(this, arguments);
                };
              
                const originalInsertBefore = Node.prototype.insertBefore;
                Node.prototype.insertBefore = function(newNode, referenceNode) {
                  if (referenceNode && referenceNode.parentNode !== this) {
                    if (console) {
                      console.warn('Cannot insert before a reference node from a different parent', referenceNode, this);
                    }
                    return newNode;
                  }
                  return originalInsertBefore.apply(this, arguments);
                };
              }
            `,
          }}
        />
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js');
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
