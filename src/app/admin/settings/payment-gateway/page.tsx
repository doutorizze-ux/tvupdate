'use client';
import { useState, useEffect, useRef } from 'react';
import type { PaymentGatewaySettings } from '@/lib/types';
import { getPaymentSettings } from '@/lib/data.actions';
import { savePaymentSettingsAction } from '@/lib/actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, CheckCircle, Upload, X } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import Image from 'next/image';

function PaymentGatewayFormSkeleton() {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <Skeleton className="h-9 w-64" />
                    <Skeleton className="h-4 w-80 mt-2" />
                </div>
                <Skeleton className="h-10 w-32" />
            </div>
            <Card>
                <CardHeader><Skeleton className="h-6 w-32" /></CardHeader>
                <CardContent className="space-y-4">
                    <Skeleton className="h-6 w-24" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                </CardContent>
            </Card>
        </div>
    );
}

export default function PaymentGatewayPage() {
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [isUploading, setIsUploading] = useState<string | null>(null);

    // Form state
    const [stripeEnabled, setStripeEnabled] = useState(false);
    const [stripePublishableKey, setStripePublishableKey] = useState('');
    const [stripeSecretKey, setStripeSecretKey] = useState('');
    const [stripeLogoUrl, setStripeLogoUrl] = useState('');
    
    const [paypalEnabled, setPaypalEnabled] = useState(false);
    const [paypalClientId, setPaypalClientId] = useState('');
    const [paypalSecret, setPaypalSecret] = useState('');
    const [paypalLogoUrl, setPaypalLogoUrl] = useState('');

    const [razorpayEnabled, setRazorpayEnabled] = useState(false);
    const [razorpayKeyId, setRazorpayKeyId] = useState('');
    const [razorpayKeySecret, setRazorpayKeySecret] = useState('');
    const [razorpayLogoUrl, setRazorpayLogoUrl] = useState('');

    const [googlePayEnabled, setGooglePayEnabled] = useState(false);
    const [googlePlayPackageName, setGooglePlayPackageName] = useState('');
    const [googlePlayServiceAccountEmail, setGooglePlayServiceAccountEmail] = useState('');
    const [googlePlayServiceAccountPrivateKey, setGooglePlayServiceAccountPrivateKey] = useState('');

    const stripeInputRef = useRef<HTMLInputElement>(null);
    const paypalInputRef = useRef<HTMLInputElement>(null);
    const razorpayInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        getPaymentSettings().then(settings => {
            if (settings) {
                const s = settings as any;
                setStripeEnabled(s.stripeEnabled || false);
                setStripePublishableKey(s.stripePublishableKey || '');
                setStripeSecretKey(s.stripeSecretKey || '');
                setStripeLogoUrl(s.stripeLogoUrl || '');
                
                setPaypalEnabled(s.paypalEnabled || false);
                setPaypalClientId(s.paypalClientId || '');
                setPaypalSecret(s.paypalSecret || '');
                setPaypalLogoUrl(s.paypalLogoUrl || '');

                setRazorpayEnabled(s.razorpayEnabled || false);
                setRazorpayKeyId(s.razorpayKeyId || '');
                setRazorpayKeySecret(s.razorpayKeySecret || '');
                setRazorpayLogoUrl(s.razorpayLogoUrl || '');

                setGooglePayEnabled(s.googlePayEnabled || false);
                setGooglePlayPackageName(s.googlePlayPackageName || '');
                setGooglePlayServiceAccountEmail(s.googlePlayServiceAccountEmail || '');
                setGooglePlayServiceAccountPrivateKey(s.googlePlayServiceAccountPrivateKey || '');
            }
            setLoading(false);
        });
    }, []);

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>, gateway: string) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(gateway);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', 'payment-logo');
        formData.append('identifier', gateway);

        try {
            const res = await fetch('/api/upload', { method: 'POST', body: formData });
            const data = await res.json();
            if (data.success && data.url) {
                if (gateway === 'stripe') setStripeLogoUrl(data.url);
                if (gateway === 'paypal') setPaypalLogoUrl(data.url);
                if (gateway === 'razorpay') setRazorpayLogoUrl(data.url);
                toast({ title: 'Logo Prepared', description: 'Logo path standardized. Click save to apply.' });
            } else {
                throw new Error(data.error || 'Upload failed');
            }
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Upload Error', description: err.message });
        } finally {
            setIsUploading(null);
            if (e.target) e.target.value = '';
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        setSaveSuccess(false);

        const newSettings = {
            stripeEnabled, stripePublishableKey, stripeSecretKey, stripeLogoUrl,
            paypalEnabled, paypalClientId, paypalSecret, paypalLogoUrl,
            razorpayEnabled, razorpayKeyId, razorpayKeySecret, razorpayLogoUrl,
            googlePayEnabled, googlePlayPackageName, googlePlayServiceAccountEmail, googlePlayServiceAccountPrivateKey
        };

        const result = await savePaymentSettingsAction(newSettings);
        if (result.success) {
            toast({ title: 'Success', description: 'Payment gateway settings have been saved.' });
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
        }
        setIsSaving(false);
    };

    if (loading) return <PaymentGatewayFormSkeleton />;

    const LogoSection = ({ label, url, onUpload, onDelete, gateway }: any) => (
        <div className="space-y-2 pt-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</Label>
            <div className="flex items-center gap-4">
                <div className="h-14 w-32 bg-black/40 rounded-xl border border-dashed border-white/10 flex items-center justify-center relative overflow-hidden group">
                    {url ? (
                        <>
                            <img src={`${url}?v=${Date.now()}`} alt="Logo" className="h-full w-full object-contain p-2" />
                            <button onClick={onDelete} className="absolute inset-0 bg-red-600/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <X className="h-4 w-4 text-white" />
                            </button>
                        </>
                    ) : (
                        <span className="text-[8px] text-white/20 font-bold uppercase">Default</span>
                    )}
                </div>
                <Button variant="outline" size="sm" onClick={onUpload} disabled={!!isUploading} className="h-12 px-4 border-dashed rounded-xl">
                    {isUploading === gateway ? <Loader2 className="animate-spin h-4 w-4" /> : <><Upload className="mr-2 h-4 w-4" /> Custom Logo</>}
                </Button>
            </div>
        </div>
    );

    return (
        <div className="space-y-6 max-w-4xl">
             <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black italic tracking-tighter uppercase">Payment Gateways</h1>
                    <p className="text-muted-foreground text-xs font-medium">Configure providers and custom logos for checkout.</p>
                </div>
                <Button onClick={handleSave} disabled={isSaving || !!isUploading} className={cn("h-12 px-8 rounded-2xl font-black uppercase tracking-widest shadow-xl transition-all", saveSuccess ? 'bg-green-600' : 'bg-primary')}>
                    {isSaving ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : saveSuccess ? <CheckCircle className="mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
                    {saveSuccess ? 'Saved!' : 'Save Settings'}
                </Button>
            </div>

            <div className="grid grid-cols-1 gap-6">
                {/* Stripe */}
                <Card className="bg-card/30 border-white/5 overflow-hidden">
                    <CardHeader className="bg-white/[0.02] border-b border-white/5 py-4">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-black uppercase tracking-widest text-blue-400">Stripe Integration</CardTitle>
                            <Switch checked={stripeEnabled} onCheckedChange={setStripeEnabled} />
                        </div>
                    </CardHeader>
                    <CardContent className={cn("space-y-6 pt-6 transition-opacity", !stripeEnabled && "opacity-50 pointer-events-none")}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold uppercase tracking-widest">Publishable Key</Label>
                                <Input value={stripePublishableKey} onChange={e => setStripePublishableKey(e.target.value)} className="bg-black/20" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold uppercase tracking-widest">Secret Key</Label>
                                <Input type="password" value={stripeSecretKey} onChange={e => setStripeSecretKey(e.target.value)} className="bg-black/20" />
                            </div>
                        </div>
                        <LogoSection 
                            label="Checkout Tab Logo" 
                            url={stripeLogoUrl} 
                            gateway="stripe"
                            onUpload={() => stripeInputRef.current?.click()} 
                            onDelete={() => setStripeLogoUrl('')} 
                        />
                        <input type="file" ref={stripeInputRef} onChange={e => handleLogoUpload(e, 'stripe')} className="hidden" accept="image/*" />
                    </CardContent>
                </Card>

                {/* PayPal */}
                <Card className="bg-card/30 border-white/5 overflow-hidden">
                    <CardHeader className="bg-white/[0.02] border-b border-white/5 py-4">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-black uppercase tracking-widest text-amber-500">PayPal Checkout</CardTitle>
                            <Switch checked={paypalEnabled} onCheckedChange={setPaypalEnabled} />
                        </div>
                    </CardHeader>
                    <CardContent className={cn("space-y-6 pt-6 transition-opacity", !paypalEnabled && "opacity-50 pointer-events-none")}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold uppercase tracking-widest">Client ID</Label>
                                <Input value={paypalClientId} onChange={e => setPaypalClientId(e.target.value)} className="bg-black/20" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold uppercase tracking-widest">Secret Key</Label>
                                <Input type="password" value={paypalSecret} onChange={e => setPaypalSecret(e.target.value)} className="bg-black/20" />
                            </div>
                        </div>
                        <LogoSection 
                            label="Checkout Tab Logo" 
                            url={paypalLogoUrl} 
                            gateway="paypal"
                            onUpload={() => paypalInputRef.current?.click()} 
                            onDelete={() => setPaypalLogoUrl('')} 
                        />
                        <input type="file" ref={paypalInputRef} onChange={e => handleLogoUpload(e, 'paypal')} className="hidden" accept="image/*" />
                    </CardContent>
                </Card>

                {/* Razorpay */}
                <Card className="bg-card/30 border-white/5 overflow-hidden">
                    <CardHeader className="bg-white/[0.02] border-b border-white/5 py-4">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-black uppercase tracking-widest text-indigo-500">Razorpay (India)</CardTitle>
                            <Switch checked={razorpayEnabled} onCheckedChange={setRazorpayEnabled} />
                        </div>
                    </CardHeader>
                    <CardContent className={cn("space-y-6 pt-6 transition-opacity", !razorpayEnabled && "opacity-50 pointer-events-none")}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold uppercase tracking-widest">Key ID</Label>
                                <Input value={razorpayKeyId} onChange={e => setRazorpayKeyId(e.target.value)} className="bg-black/20" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold uppercase tracking-widest">Key Secret</Label>
                                <Input type="password" value={razorpayKeySecret} onChange={e => setRazorpayKeySecret(e.target.value)} className="bg-black/20" />
                            </div>
                        </div>
                        <LogoSection 
                            label="Checkout Tab Logo" 
                            url={razorpayLogoUrl} 
                            gateway="razorpay"
                            onUpload={() => razorpayInputRef.current?.click()} 
                            onDelete={() => setRazorpayLogoUrl('')} 
                        />
                        <input type="file" ref={razorpayInputRef} onChange={e => handleLogoUpload(e, 'razorpay')} className="hidden" accept="image/*" />
                    </CardContent>
                </Card>

                {/* Google Pay */}
                <Card className="bg-card/30 border-white/5 overflow-hidden">
                    <CardHeader className="bg-white/[0.02] border-b border-white/5 py-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-full bg-white flex items-center justify-center">
                                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M12 12.5c0-2.485 2.015-4.5 4.5-4.5S21 10.015 21 12.5 18.985 17 16.5 17 12 14.985 12 12.5z" fill="#4285F4"/>
                                        <path d="M3 12.5C3 10.015 5.015 8 7.5 8S12 10.015 12 12.5 9.985 17 7.5 17 3 14.985 3 12.5z" fill="#34A853"/>
                                        <path d="M7.5 8C8.828 8 10 8.672 10.75 9.72L12 12.5l-1.25 2.78C10 16.328 8.828 17 7.5 17c-2.485 0-4.5-2.015-4.5-4.5S5.015 8 7.5 8z" fill="#FBBC05"/>
                                        <path d="M12 12.5l-1.25-2.78C11.458 8.637 12.916 8 14.5 8c2.485 0 4.5 2.015 4.5 4.5S16.985 17 14.5 17c-1.584 0-3.042-.637-3.75-1.72L12 12.5z" fill="#EA4335"/>
                                    </svg>
                                </div>
                                <CardTitle className="text-sm font-black uppercase tracking-widest text-green-400">Google Pay (In-App)</CardTitle>
                            </div>
                            <Switch checked={googlePayEnabled} onCheckedChange={setGooglePayEnabled} />
                        </div>
                    </CardHeader>
                    <CardContent className={cn("space-y-6 pt-6 transition-opacity", !googlePayEnabled && "opacity-50 pointer-events-none")}>
                        <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-4 text-sm text-blue-300">
                            <p className="font-bold mb-1">ℹ️ Google Play Billing & Server-Side Verification</p>
                            <p className="text-xs leading-relaxed text-blue-300/80">
                                Google Pay for in-app purchases uses <strong>Google Play Billing</strong>. 
                                To prevent fraud and ensure secure purchases, please configure your Google Play Developer API credentials below.
                            </p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold uppercase tracking-widest">Google Play Package Name</Label>
                                <Input value={googlePlayPackageName} onChange={e => setGooglePlayPackageName(e.target.value)} placeholder="com.snapreels.app" className="bg-black/20" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold uppercase tracking-widest">Service Account Email</Label>
                                <Input value={googlePlayServiceAccountEmail} onChange={e => setGooglePlayServiceAccountEmail(e.target.value)} placeholder="play-billing@project.iam.gserviceaccount.com" className="bg-black/20" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase tracking-widest">Service Account Private Key (PEM format)</Label>
                            <textarea 
                                value={googlePlayServiceAccountPrivateKey} 
                                onChange={e => setGooglePlayServiceAccountPrivateKey(e.target.value)} 
                                placeholder="-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC..." 
                                className="w-full min-h-[120px] bg-black/20 text-white rounded-xl border border-white/10 p-3 text-xs font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus:border-primary transition-colors"
                            />
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
