'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { useTranslations, useLocale } from 'next-intl';
import {
    MapPin,
    Phone,
    Mail,
    Facebook,
    Instagram,
    Twitter as TwitterIcon,
    Globe,
    ArrowUpRight
} from 'lucide-react';
import { useSiteSettings } from '@/lib/settings-context';
import { usePathname } from 'next/navigation';

export default function Footer() {
    const pathname = usePathname();
    // useLocale() call triggers re-render on language change
    useLocale();
    const tNav = useTranslations('nav');
    const tFooter = useTranslations('footer');
    const { settings } = useSiteSettings();

    // Don't show footer on admin or staff pages
    if (pathname?.startsWith('/admin') || pathname?.startsWith('/staff')) {
        return null;
    }

    // Helper to translate nav items
    const getNavTranslation = (slug: string) => {
        const navMap: Record<string, string> = {
            'restaurant': tNav('restaurant'),
            'chalets': tNav('chalets'),
            'pool': tNav('pool'),
            'snack-bar': tNav('snackBar'),
            'snackbar': tNav('snackBar'),
        };
        return navMap[slug.toLowerCase()] || slug;
    };

    // Build footer with translations - always use translated defaults
    const defaultFooterConfig = {
        logo: { text: settings.resortName || 'V2 Resort', showIcon: true },
        description: tFooter('description'),
        columns: [
            {
                title: tFooter('quickLinks'),
                links: [
                    { label: tNav('restaurant'), href: '/restaurant' },
                    { label: tNav('snackBar'), href: '/snack-bar' },
                    { label: tNav('chalets'), href: '/chalets' },
                    { label: tNav('pool'), href: '/pool' }
                ]
            },
            {
                title: tFooter('legal'),
                links: [
                    { label: tFooter('privacyPolicy'), href: '/privacy' },
                    { label: tFooter('termsOfService'), href: '/terms' },
                    { label: tFooter('cancellationPolicy'), href: '/cancellation' }
                ]
            }
        ],
        socials: [
            { platform: 'facebook', url: 'https://facebook.com' },
            { platform: 'instagram', url: 'https://instagram.com' }
        ],
        contact: {
            showAddress: true,
            showPhone: true,
            showEmail: true
        },
        copyright: tFooter('copyright', { year: new Date().getFullYear() })
    };

    // If CMS footer exists, translate its content
    interface FooterLink {
        label?: string;
        labelKey?: string;
        href: string;
        moduleSlug?: string;
    }
    interface FooterColumn {
        title?: string;
        titleKey?: string;
        links?: FooterLink[];
    }
    const footerConfig = settings.footer ? {
        ...settings.footer,
        logo: settings.footer.logo || defaultFooterConfig.logo,
        description: settings.footer.description || defaultFooterConfig.description,
        columns: settings.footer.columns?.map((col: FooterColumn) => ({
            ...col,
            // Translate column title if it matches known keys
            title: col.titleKey ? tFooter(col.titleKey) : col.title,
            links: col.links?.map((link: FooterLink) => ({
                ...link,
                // Translate link labels for module links
                label: link.moduleSlug ? getNavTranslation(link.moduleSlug) : 
                       link.labelKey ? tFooter(link.labelKey) : link.label
            }))
        })) || defaultFooterConfig.columns,
        copyright: settings.footer.copyright || defaultFooterConfig.copyright
    } : defaultFooterConfig;

    const getSocialIcon = (platform: string) => {
        switch (platform.toLowerCase()) {
            case 'facebook': return <Facebook className="w-5 h-5" />;
            case 'instagram': return <Instagram className="w-5 h-5" />;
            case 'twitter': return <TwitterIcon className="w-5 h-5" />;
            default: return <Globe className="w-5 h-5" />;
        }
    };

    return (
        <footer className="relative bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 dark:from-slate-950 dark:via-slate-950 dark:to-black text-white py-20 overflow-hidden">
            {/* Background glass effects */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl" />
                <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-secondary-500/10 rounded-full blur-3xl" />
            </div>
            
            <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
                    {/* Brand Column */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="space-y-6"
                    >
                        <div className="flex items-center space-x-3">
                            {footerConfig.logo.showIcon && (
                                <motion.div
                                    whileHover={{ rotate: 360, scale: 1.05 }}
                                    transition={{ duration: 0.5 }}
                                    className="w-12 h-12 bg-gradient-to-br from-primary-400 via-primary-500 to-primary-600 rounded-xl flex items-center justify-center shadow-xl shadow-primary-500/30 backdrop-blur-sm"
                                >
                                    <span className="text-white font-bold text-xl">
                                        {footerConfig.logo.text.substring(0, 2)}
                                    </span>
                                </motion.div>
                            )}
                            <span className="text-2xl font-bold tracking-tight bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                                {footerConfig.logo.text.substring(footerConfig.logo.showIcon ? 2 : 0)}
                            </span>
                        </div>

                        <p className="text-slate-400/90 leading-relaxed max-w-xs">
                            {footerConfig.description}
                        </p>

                        {footerConfig.socials && footerConfig.socials.length > 0 && (
                            <div className="flex items-center gap-3">
                                {footerConfig.socials.map((social: { platform: string; url: string }) => (
                                    <motion.a
                                        key={social.platform}
                                        href={social.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        whileHover={{ scale: 1.1, y: -3 }}
                                        whileTap={{ scale: 0.9 }}
                                        className="p-2.5 bg-white/5 hover:bg-primary-500/20 backdrop-blur-lg border border-white/10 hover:border-primary-500/30 rounded-xl transition-all duration-300 text-slate-400 hover:text-primary-400"
                                    >
                                        {getSocialIcon(social.platform)}
                                    </motion.a>
                                ))}
                            </div>
                        )}
                    </motion.div>

                    {/* Dynamic Columns */}
                    {footerConfig.columns.map((column: FooterColumn, idx: number) => (
                        <motion.div
                            key={column.title}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.1 * (idx + 1) }}
                        >
                            <h4 className="text-sm font-semibold uppercase tracking-wider text-white/80 mb-6 font-primary">
                                {column.title}
                            </h4>
                            <ul className="space-y-4">
                                {column.links?.map((link: FooterLink) => (
                                    <li key={link.label}>
                                        <Link
                                            href={link.href}
                                            className="text-slate-400/90 hover:text-white transition-all duration-300 flex items-center group"
                                        >
                                            <span className="relative">
                                                {link.label}
                                                <span className="absolute -bottom-0.5 left-0 w-0 h-px bg-primary-400 group-hover:w-full transition-all duration-300" />
                                            </span>
                                            <ArrowUpRight className="w-3 h-3 ml-1 opacity-0 group-hover:opacity-100 -translate-y-1 translate-x-1 group-hover:translate-y-0 group-hover:translate-x-0 transition-all duration-300" />
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </motion.div>
                    ))}

                    {/* Contact Column */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.3 }}
                    >
                        <h4 className="text-sm font-semibold uppercase tracking-wider text-white/80 mb-6">
                            {tFooter('contact')}
                        </h4>
                        <ul className="space-y-4 text-slate-400/90">
                            {footerConfig.contact.showAddress && (
                                <li className="flex items-start gap-3 group">
                                    <div className="p-2 bg-primary-500/10 rounded-lg group-hover:bg-primary-500/20 transition-colors duration-300">
                                        <MapPin className="w-4 h-4 text-primary-400" />
                                    </div>
                                    <span className="text-sm leading-relaxed">{settings.address || tFooter('address')}</span>
                                </li>
                            )}
                            {footerConfig.contact.showPhone && (
                                <li className="flex items-center gap-3 group">
                                    <div className="p-2 bg-primary-500/10 rounded-lg group-hover:bg-primary-500/20 transition-colors duration-300">
                                        <Phone className="w-4 h-4 text-primary-400" />
                                    </div>
                                    <span className="text-sm">{settings.phone || tFooter('phone')}</span>
                                </li>
                            )}
                            {footerConfig.contact.showEmail && (
                                <li className="flex items-center gap-3 group">
                                    <div className="p-2 bg-primary-500/10 rounded-lg group-hover:bg-primary-500/20 transition-colors duration-300">
                                        <Mail className="w-4 h-4 text-primary-400" />
                                    </div>
                                    <span className="text-sm">{settings.email || tFooter('email')}</span>
                                </li>
                            )}
                        </ul>
                    </motion.div>
                </div>

                {/* Bottom Bar with glass effect */}
                <div className="mt-12 pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
                    <p className="text-sm text-slate-500">
                        {footerConfig.copyright.replace('{year}', new Date().getFullYear().toString())}
                    </p>
                    <div className="flex items-center gap-4">
                        <div className="px-4 py-1.5 bg-white/5 backdrop-blur-lg border border-white/10 rounded-full">
                            <span className="text-xs text-slate-400 uppercase tracking-widest font-medium">
                                V2 Ecosystem v2.0
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    );
}
