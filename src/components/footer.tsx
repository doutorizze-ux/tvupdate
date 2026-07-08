'use client';

import { useState, useEffect } from 'react';
import type { CustomPage } from '@/lib/types';
import { Facebook, Instagram, Twitter, Youtube, Music2, Apple } from 'lucide-react';
import Link from 'next/link';
import { Skeleton } from './ui/skeleton';
import { useParams } from 'next/navigation';
import { i18n } from '@/i18n-config';
import { useSettings } from '@/lib/settings-provider';
import { useTranslation } from '@/lib/translation-provider';
import { getCustomPages } from '@/lib/data.actions';
import { cn } from '@/lib/utils';

const socialIcons: { [key: string]: React.ElementType } = {
    facebook: Facebook,
    instagram: Instagram,
    twitter: Twitter,
    youtube: Youtube,
    tiktok: Music2,
};

function FooterSkeleton() {
    return (
        <footer className="bg-card/30 mt-auto border-t border-white/5">
            <div className="container mx-auto px-4 py-16 text-center">
                <div className="flex flex-col items-center gap-12">
                    <div className="flex gap-4">
                         <Skeleton className="h-10 w-32 rounded-xl" />
                         <Skeleton className="h-10 w-32 rounded-xl" />
                    </div>
                    <div className="flex gap-8">
                        <Skeleton className="h-6 w-6 rounded-full" />
                        <Skeleton className="h-6 w-6 rounded-full" />
                    </div>
                    <Skeleton className="h-5 w-72" />
                </div>
            </div>
        </footer>
    );
}

export function Footer() {
    const params = useParams();
    const settings = useSettings();
    const { t } = useTranslation();
    const lang = (params?.lang as string) || i18n.defaultLocale;
    const langPrefix = lang === i18n.defaultLocale ? '' : `/${lang}`;
    
    const [pages, setPages] = useState<CustomPage[]>([]);
    const [pagesLoading, setPagesLoading] = useState(true);

    useEffect(() => {
        getCustomPages().then(data => {
            setPages(data.filter(p => p.showInFooter));
            setPagesLoading(false);
        });
    }, []);

    if (pagesLoading) return <FooterSkeleton />;

    const defaultCopyright = `© 2026 SnapReels. All rights reserved.`;
    const showCopyright = settings?.showCopyright !== false;
    const showVersion = settings?.showVersion === true;
    const appVersion = settings?.appVersion || '1.0.0';

    const StoreBadge = ({ href, type }: { href: string; type: 'apple' | 'google' }) => (
        <a 
            href={href} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="flex items-center gap-2 bg-black/40 backdrop-blur-sm border border-white/5 hover:border-white/20 transition-all px-3 py-1.5 rounded-xl group min-w-[130px]"
        >
            {type === 'apple' ? (
                <Apple className="h-5 w-5 text-white fill-current" />
            ) : (
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-white" xmlns="http://www.w3.org/2000/svg">
                    <path d="M3,20.5V3.41c0-0.72,0.52-1.17,1.38-1.17c0.31,0,0.55,0.07,0.79,0.21l13.6,7.83c0.41,0.24,0.66,0.66,0.66,1.12 s-0.25,0.88-0.66,1.12L5.17,20.35c-0.24,0.14-0.48,0.21-0.79,0.21C3.52,20.56,3,20.11,3,19.39V20.5z M4.38,3.56v15.65l13.56-7.83 L4.38,3.56z"/>
                </svg>
            )}
            <div className="flex flex-col items-start leading-none text-left">
                <span className="text-[7px] uppercase font-bold text-white/40">{t('footer_download_on')}</span>
                <span className="text-[10px] font-black text-white">{type === 'apple' ? t('footer_download_store_apple') : t('footer_download_store_google')}</span>
            </div>
        </a>
    );

    const hasStoreLinks = !!(settings?.appStoreUrl || settings?.playStoreUrl);

    return (
        <footer className="bg-background mt-auto border-t border-white/5 relative overflow-hidden">
            <div className="container mx-auto px-4 pt-12 pb-20 space-y-6 relative z-10">
                <div className="flex flex-col items-center gap-8 text-center">
                    
                    {/* 1. STORE BADGES */}
                    {hasStoreLinks && (
                        <div className="flex flex-row justify-center gap-4 w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
                            {settings?.appStoreUrl && <StoreBadge href={settings.appStoreUrl} type="apple" />}
                            {settings?.playStoreUrl && <StoreBadge href={settings.playStoreUrl} type="google" />}
                        </div>
                    )}

                    <div className="space-y-6 w-full max-w-lg">
                         {/* 2. SOCIAL ICONS */}
                         {settings?.showSocialsInFooter && settings?.socials && (
                            <div className="flex justify-center gap-8 px-4">
                                {Object.entries(settings.socials).map(([key, url]) => {
                                    const Icon = socialIcons[key];
                                    if (!url || !Icon) return null;
                                    return (
                                        <a key={key} href={url} target="_blank" rel="noopener noreferrer" className="text-white/40 hover:text-white transition-all hover:scale-125 duration-300">
                                            <Icon className="h-6 w-6" />
                                            <span className="sr-only">{key}</span>
                                        </a>
                                    )
                                })}
                            </div>
                        )}
                        
                        {/* 3. PAGE LINKS */}
                        <div className="flex flex-wrap justify-center items-center gap-x-4 md:gap-x-12 gap-y-3 px-2">
                            {pages?.map(page => (
                                <Link 
                                    key={page.id} 
                                    href={`${langPrefix}/p/${page.slug}`} 
                                    className="text-[8.5px] md:text-[11px] font-black text-white hover:text-primary transition-colors uppercase tracking-[0.15em] whitespace-nowrap"
                                >
                                    {t(`page_title_${page.slug}`) || page.title}
                                </Link>
                            ))}
                            <Link 
                                href={`${langPrefix}/contact`} 
                                className="text-[8.5px] md:text-[11px] font-black text-white hover:text-primary transition-colors uppercase tracking-[0.15em] whitespace-nowrap"
                            >
                                {t('footer_contact_us')}
                            </Link>
                        </div>
                    </div>
                </div>
                
                {/* 4. ABSOLUTE BOTTOM SECTION */}
                <div className="pt-4 border-t border-white/5 flex flex-col items-center gap-2">
                    {showCopyright && (
                        <div className="text-[9px] font-bold text-white/30 tracking-widest uppercase text-center">
                            {t('footer_copyright_text') || settings?.copyrightText || defaultCopyright}
                        </div>
                    )}
                    {showVersion && (
                        <div className="text-[8px] font-black text-white/10 tracking-[0.3em] uppercase text-center">
                            Version {appVersion}
                        </div>
                    )}
                </div>
            </div>

            {/* Background Glow */}
            <div className="absolute -bottom-20 left-1/2 -translate-x-1/2 w-64 h-64 bg-primary/5 blur-[100px] rounded-full pointer-events-none" />
        </footer>
    );
}
