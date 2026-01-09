'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
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
    const tNav = useTranslations('nav');
    const tFooter = useTranslations('footer');
    const { settings } = useSiteSettings();

    // Don't show footer on admin or staff pages
    if (pathname?.startsWith('/admin') || pathname?.startsWith('/staff')) {
        return null;
    }

    // Get footer data from settings or use defaults
    const footerConfig = settings.footer || {
        logo: { text: 'V2 Resort', showIcon: true },
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

    const getSocialIcon = (platform: string) => {
        switch (platform.toLowerCase()) {
            case 'facebook': return <Facebook className="w-5 h-5" />;
            case 'instagram': return <Instagram className="w-5 h-5" />;
            case 'twitter': return <TwitterIcon className="w-5 h-5" />;
            default: return <Globe className="w-5 h-5" />;
        }
    };

    return (
        <footer className="bg-slate-900 dark:bg-slate-950 text-white py-16">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
                    {/* Brand Column */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="space-y-6"
                    >
                        <div className="flex items-center space-x-2">
                            {footerConfig.logo.showIcon && (
                                <motion.div
                                    whileHover={{ rotate: 360 }}
                                    transition={{ duration: 0.5 }}
                                    className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-700 rounded-lg flex items-center justify-center shadow-lg shadow-primary-500/20"
                                >
                                    <span className="text-white font-bold text-xl">
                                        {footerConfig.logo.text.substring(0, 2)}
                                    </span>
                                </motion.div>
                            )}
                            <span className="text-xl font-bold tracking-tight">
                                {footerConfig.logo.text.substring(footerConfig.logo.showIcon ? 2 : 0)}
                            </span>
                        </div>

                        <p className="text-slate-400 leading-relaxed max-w-xs">
                            {footerConfig.description}
                        </p>

                        {footerConfig.socials && footerConfig.socials.length > 0 && (
                            <div className="flex items-center gap-4">
                                {footerConfig.socials.map((social: any) => (
                                    <motion.a
                                        key={social.platform}
                                        href={social.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        whileHover={{ scale: 1.1, y: -2 }}
                                        whileTap={{ scale: 0.9 }}
                                        className="p-2 bg-slate-800 hover:bg-primary-600 rounded-full transition-colors duration-300"
                                    >
                                        {getSocialIcon(social.platform)}
                                    </motion.a>
                                ))}
                            </div>
                        )}
                    </motion.div>

                    {/* Dynamic Columns */}
                    {footerConfig.columns.map((column: any, idx: number) => (
                        <motion.div
                            key={column.title}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.1 * (idx + 1) }}
                        >
                            <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-300 mb-6 font-primary">
                                {column.title}
                            </h4>
                            <ul className="space-y-4">
                                {column.links.map((link: any) => (
                                    <li key={link.label}>
                                        <Link
                                            href={link.href}
                                            className="text-slate-400 hover:text-white transition-colors flex items-center group"
                                        >
                                            <span>{link.label}</span>
                                            <ArrowUpRight className="w-3 h-3 ml-1 opacity-0 group-hover:opacity-100 -translate-y-1 translate-x-1 group-hover:translate-y-0 group-hover:translate-x-0 transition-all" />
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
                        <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-300 mb-6">
                            {tFooter('contact')}
                        </h4>
                        <ul className="space-y-4 text-slate-400">
                            {footerConfig.contact.showAddress && (
                                <li className="flex items-start gap-3">
                                    <MapPin className="w-5 h-5 text-primary-400 shrink-0 mt-0.5" />
                                    <span className="text-sm">{settings.address || tFooter('address')}</span>
                                </li>
                            )}
                            {footerConfig.contact.showPhone && (
                                <li className="flex items-center gap-3">
                                    <Phone className="w-5 h-5 text-primary-400 shrink-0" />
                                    <span className="text-sm">{settings.phone || tFooter('phone')}</span>
                                </li>
                            )}
                            {footerConfig.contact.showEmail && (
                                <li className="flex items-center gap-3">
                                    <Mail className="w-5 h-5 text-primary-400 shrink-0" />
                                    <span className="text-sm">{settings.email || tFooter('email')}</span>
                                </li>
                            )}
                        </ul>
                    </motion.div>
                </div>

                <div className="border-t border-slate-800 dark:border-slate-700/50 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
                    <p className="text-sm text-slate-500">
                        {footerConfig.copyright.replace('{year}', new Date().getFullYear().toString())}
                    </p>
                    <div className="flex items-center gap-6">
                        <span className="text-xs text-slate-600 uppercase tracking-widest font-medium">
                            V2 Ecosystem v2.0
                        </span>
                    </div>
                </div>
            </div>
        </footer>
    );
}
