'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useEffect, useState, useRef, useTransition } from 'react';
import type { GeneralSettings } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Upload, Image as ImageIcon, Globe, Type, Link as LinkIcon, Copyright, Facebook, Instagram, Youtube, CheckCircle, RefreshCw, ListOrdered, Music2, Tag, Smartphone, X, Twitter } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { revalidateAllAction, saveGeneralSettingsAction } from '@/lib/actions';
import { getGeneralSettings } from '@/lib/data.actions';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';

const formSchema = z.object({
  siteName: z.string().optional(),
  siteUrl: z.string().optional(),
  logoUrl: z.string().optional(),
  faviconUrl: z.string().optional(),
  copyrightText: z.string().optional(),
  appVersion: z.string().optional(),
  showCopyright: z.boolean().default(true),
  showVersion: z.boolean().default(true),
  seriesUrlFormat: z.enum(['hash', 'slug']).default('hash'),
  showSocialsInFooter: z.boolean().default(false),
  showSiteNameNextToLogo: z.boolean().default(true),
  episodesPerPage: z.coerce.number().min(1).max(500).default(15),
  socials: z.object({
    facebook: z.string().optional(),
    instagram: z.string().optional(),
    tiktok: z.string().optional(),
    youtube: z.string().optional(),
    twitter: z.string().optional(),
  }).optional(),
  appStoreUrl: z.string().optional(),
  playStoreUrl: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function GeneralSettingsPage() {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isRevalidating, startRevalidateTransition] = useTransition();

  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);

  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [faviconPreview, setFaviconPreview] = useState<string | null>(null);
  const [webpEnabled, setWebpEnabled] = useState(true);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      siteName: '',
      siteUrl: '',
      logoUrl: '',
      faviconUrl: '',
      copyrightText: '',
      appVersion: '',
      showCopyright: true,
      showVersion: true,
      seriesUrlFormat: 'hash',
      showSocialsInFooter: false,
      showSiteNameNextToLogo: true,
      episodesPerPage: 15,
      socials: { facebook: '', instagram: '', tiktok: '', youtube: '', twitter: '' },
      appStoreUrl: '',
      playStoreUrl: '',
    },
  });

  const fetchData = async () => {
    setLoading(true);
    const settings = await getGeneralSettings();
    if (settings) {
      form.reset({
          siteName: settings.siteName || '',
          siteUrl: settings.siteUrl || '',
          logoUrl: settings.logoUrl || '',
          faviconUrl: settings.faviconUrl || '',
          copyrightText: settings.copyrightText || '',
          appVersion: settings.appVersion || '',
          showCopyright: settings.showCopyright ?? true,
          showVersion: settings.showVersion ?? true,
          seriesUrlFormat: settings.seriesUrlFormat || 'hash',
          showSocialsInFooter: settings.showSocialsInFooter ?? false,
          showSiteNameNextToLogo: settings.showSiteNameNextToLogo ?? true,
          episodesPerPage: settings.episodesPerPage || 15,
          socials: settings.socials || { facebook: '', instagram: '', tiktok: '', youtube: '', twitter: '' },
          appStoreUrl: settings.appStoreUrl || '',
          playStoreUrl: settings.playStoreUrl || '',
      });
      setLogoPreview(settings.logoUrl || null);
      setFaviconPreview(settings.faviconUrl || null);
      setWebpEnabled(settings.webpConversionEnabled !== false);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleClearCache = () => {
    startRevalidateTransition(async () => {
        const result = await revalidateAllAction();
        if (result.success) {
            toast({ title: 'Cache Cleared', description: 'The website frontend cache has been refreshed.' });
        }
    });
  }

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'favicon') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(type);
    
    const processImage = async (originalFile: File): Promise<Blob | null> => {
        return new Promise((resolve) => {
            const img = document.createElement('img');
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (type === 'favicon') {
                    width = 32;
                    height = 32;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);

                const format = webpEnabled ? 'image/webp' : (type === 'favicon' ? 'image/png' : originalFile.type);
                canvas.toBlob((blob) => resolve(blob), format, 0.9);
            };
            img.src = URL.createObjectURL(originalFile);
        });
    };

    const processedBlob = await processImage(file);
    if (!processedBlob) {
        setIsUploading(null);
        return;
    }

    const formData = new FormData();
    const extension = webpEnabled ? '.webp' : (type === 'favicon' ? '.png' : '.jpg');
    const fileName = type === 'favicon' ? `favicon${extension}` : `logo${extension}`;
    formData.append('file', processedBlob, fileName);

    try {
        const res = await fetch('/api/upload', { method: 'POST', body: formData });
        const data = await res.json();
        if (data.success && data.url) {
            if (type === 'logo') {
                setLogoPreview(data.url);
                form.setValue('logoUrl', data.url, { shouldValidate: true });
            } else {
                setFaviconPreview(data.url);
                form.setValue('faviconUrl', data.url, { shouldValidate: true });
            }
            toast({ title: `${type.toUpperCase()} uploaded successfully` });
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

  const handleImageDelete = (type: 'logo' | 'favicon') => {
    if (type === 'logo') {
      setLogoPreview(null);
      form.setValue('logoUrl', '', { shouldValidate: true });
    } else {
      setFaviconPreview(null);
      form.setValue('faviconUrl', '', { shouldValidate: true });
    }
  };

  const onSubmit = async (values: FormValues) => {
    setIsSaving(true);
    setSaveSuccess(false);
    
    try {
        const result = await saveGeneralSettingsAction(values);
        if (result.success) {
            toast({ title: 'Success', description: 'General settings saved.' });
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
            fetchData();
        } else {
            throw new Error(result.error);
        }
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error', description: error.message || 'Failed to save settings.' });
    } finally {
        setIsSaving(false);
    }
  };

  const onError = (errors: any) => {
      console.log("Form Errors:", errors);
      toast({
          variant: 'destructive',
          title: 'Validation Error',
          description: 'Please check the form for missing or incorrect fields.',
      });
  };

  if (loading) {
      return <div className="space-y-6"><Skeleton className="h-40 w-full" /><Skeleton className="h-80 w-full" /></div>;
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit, onError)} className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">General Settings</h1>
            <p className="text-muted-foreground">Manage global application settings via MongoDB.</p>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={handleClearCache} disabled={isRevalidating}>
                {isRevalidating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Clear Website Cache
            </Button>
            <Button type="submit" disabled={isSaving || !!isUploading} className={cn(saveSuccess && 'bg-green-500 hover:bg-green-600')}>
                {isSaving ? <Loader2 className="animate-spin" /> : saveSuccess ? <CheckCircle /> : <Save />}
                {saveSuccess ? 'Saved!' : 'Save Changes'}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Site Information</CardTitle>
                        <CardDescription>Branding and site-wide metadata.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField name="siteName" control={form.control} render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="flex items-center gap-2"><Type className="h-4 w-4"/> Site Name</FormLabel>
                                    <FormControl><Input {...field} placeholder="SnapReels" /></FormControl>
                                </FormItem>
                            )}/>
                            <FormField name="siteUrl" control={form.control} render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="flex items-center gap-2"><Globe className="h-4 w-4"/> Site URL</FormLabel>
                                    <FormControl><Input {...field} placeholder="https://example.com" /></FormControl>
                                    <FormDescription className="text-[10px]">Important for PWA and Sitemap.</FormDescription>
                                </FormItem>
                            )}/>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
                            <FormField name="logoUrl" control={form.control} render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="flex items-center gap-2"><ImageIcon className="h-4 w-4"/> Site Logo</FormLabel>
                                    <div className="flex flex-col gap-4">
                                        <div className="relative group h-12 w-32 bg-muted/30 rounded-md border border-dashed flex items-center justify-center overflow-hidden">
                                            {logoPreview ? (
                                                <>
                                                    <img src={logoPreview} alt="Logo" className="h-full w-auto object-contain p-1" />
                                                    <button 
                                                        type="button"
                                                        onClick={() => handleImageDelete('logo')}
                                                        className="absolute top-0 right-0 bg-destructive text-white p-0.5 rounded-bl-md opacity-0 group-hover:opacity-100 transition-opacity"
                                                    >
                                                        <X className="h-3 w-3" />
                                                    </button>
                                                </>
                                            ) : (
                                                <ImageIcon className="h-5 w-5 text-muted-foreground/50" />
                                            )}
                                        </div>
                                        <input type="file" accept="image/*" ref={logoInputRef} onChange={(e) => handleImageChange(e, 'logo')} className="hidden"/>
                                        <Button type="button" variant="outline" size="sm" onClick={() => logoInputRef.current?.click()} disabled={!!isUploading} className="w-fit">
                                            {isUploading === 'logo' ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Upload className="h-4 w-4 mr-2" />}
                                            Upload Logo
                                        </Button>
                                    </div>
                                </FormItem>
                            )}/>
                            <FormField name="faviconUrl" control={form.control} render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="flex items-center gap-2"><Globe className="h-4 w-4"/> Favicon (Auto 32x32)</FormLabel>
                                    <div className="flex flex-col gap-4">
                                         <div className="relative group h-12 w-12 bg-muted/30 rounded-md border border-dashed flex items-center justify-center overflow-hidden text-center">
                                            {faviconPreview ? (
                                                <>
                                                    <img src={faviconPreview} alt="Favicon" className="h-8 w-8 object-contain mx-auto" />
                                                    <button 
                                                        type="button"
                                                        onClick={() => handleImageDelete('favicon')}
                                                        className="absolute top-0 right-0 bg-destructive text-white p-0.5 rounded-bl-md opacity-0 group-hover:opacity-100 transition-opacity"
                                                    >
                                                        <X className="h-3 w-3" />
                                                    </button>
                                                </>
                                            ) : (
                                                <ImageIcon className="h-5 w-5 text-muted-foreground/50 mx-auto" />
                                            )}
                                        </div>
                                        <input type="file" accept="image/*" ref={faviconInputRef} onChange={(e) => handleImageChange(e, 'favicon')} className="hidden"/>
                                        <Button type="button" variant="outline" size="sm" onClick={() => faviconInputRef.current?.click()} disabled={!!isUploading} className="w-fit">
                                            {isUploading === 'favicon' ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Upload className="h-4 w-4 mr-2" />}
                                            Update Favicon
                                        </Button>
                                    </div>
                                </FormItem>
                            )}/>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Display & Formatting</CardTitle>
                        <CardDescription>Configure how content is presented to users.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField name="seriesUrlFormat" control={form.control} render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="flex items-center gap-2"><Tag className="h-4 w-4"/> Series URL Format</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            <SelectItem value="hash">ID Based (e.g., /series/123456)</SelectItem>
                                            <SelectItem value="slug">Slug Based (e.g., /series/my-movie-title)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormDescription>Slug based URLs are better for SEO.</FormDescription>
                                </FormItem>
                            )}/>
                             <FormField name="showSiteNameNextToLogo" control={form.control} render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 mt-6">
                                    <div className="space-y-0.5">
                                        <FormLabel>Show Site Name</FormLabel>
                                        <FormDescription>Display text next to the logo.</FormDescription>
                                    </div>
                                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                </FormItem>
                            )}/>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField name="episodesPerPage" control={form.control} render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="flex items-center gap-2"><ListOrdered className="h-4 w-4"/> Episodes Per Page</FormLabel>
                                    <FormControl><Input type="number" {...field} /></FormControl>
                                    <FormDescription>Pagination size for the series detail page.</FormDescription>
                                </FormItem>
                            )}/>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Social Media Links</CardTitle>
                        <CardDescription>External profiles and display options.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <FormField name="showSocialsInFooter" control={form.control} render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5">
                                    <FormLabel>Show Icons in Footer</FormLabel>
                                    <FormDescription>Display social links at the bottom of the site.</FormDescription>
                                </div>
                                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                            </FormItem>
                        )}/>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField name="socials.facebook" control={form.control} render={({ field }) => (
                                <FormItem><FormLabel className="flex items-center gap-2"><Facebook className="h-3 w-3"/> Facebook</FormLabel><FormControl><Input {...field} placeholder="https://..."/></FormControl></FormItem>
                            )}/>
                            <FormField name="socials.instagram" control={form.control} render={({ field }) => (
                                <FormItem><FormLabel className="flex items-center gap-2"><Instagram className="h-3 w-3"/> Instagram</FormLabel><FormControl><Input {...field} placeholder="https://..."/></FormControl></FormItem>
                            )}/>
                             <FormField name="socials.tiktok" control={form.control} render={({ field }) => (
                                <FormItem><FormLabel className="flex items-center gap-2"><Music2 className="h-3 w-3"/> TikTok</FormLabel><FormControl><Input {...field} placeholder="https://..."/></FormControl></FormItem>
                            )}/>
                            <FormField name="socials.youtube" control={form.control} render={({ field }) => (
                                <FormItem><FormLabel className="flex items-center gap-2"><Youtube className="h-3 w-3"/> YouTube</FormLabel><FormControl><Input {...field} placeholder="https://..."/></FormControl></FormItem>
                            )}/>
                            <FormField name="socials.twitter" control={form.control} render={({ field }) => (
                                <FormItem><FormLabel className="flex items-center gap-2"><Twitter className="h-3 w-3"/> Twitter (X)</FormLabel><FormControl><Input {...field} placeholder="https://..."/></FormControl></FormItem>
                            )}/>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Footer & Versioning</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <FormField name="copyrightText" control={form.control} render={({ field }) => (
                            <FormItem>
                                <FormLabel className="flex items-center gap-2"><Copyright className="h-4 w-4"/> Copyright Text</FormLabel>
                                <FormControl><Input {...field} placeholder="© 2025 SnapReels. All rights reserved." /></FormControl>
                            </FormItem>
                        )}/>
                        <FormField name="appVersion" control={form.control} render={({ field }) => (
                            <FormItem>
                                <FormLabel className="flex items-center gap-2"><LinkIcon className="h-4 w-4"/> App Version</FormLabel>
                                <FormControl><Input {...field} placeholder="1.0.0" /></FormControl>
                            </FormItem>
                        )}/>

                        <Separator />

                        <FormField name="showCopyright" control={form.control} render={({ field }) => (
                            <FormItem className="flex items-center justify-between">
                                <FormLabel>Show Copyright</FormLabel>
                                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                            </FormItem>
                        )}/>
                        <FormField name="showVersion" control={form.control} render={({ field }) => (
                            <FormItem className="flex items-center justify-between">
                                <FormLabel>Show Version</FormLabel>
                                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                            </FormItem>
                        )}/>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Store Links</CardTitle>
                        <CardDescription>Links to your mobile apps.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <FormField name="appStoreUrl" control={form.control} render={({ field }) => (
                            <FormItem>
                                <FormLabel className="flex items-center gap-2"><Smartphone className="h-4 w-4"/> App Store (iOS)</FormLabel>
                                <FormControl><Input {...field} placeholder="https://apps.apple.com/..." /></FormControl>
                            </FormItem>
                        )}/>
                        <FormField name="playStoreUrl" control={form.control} render={({ field }) => (
                            <FormItem>
                                <FormLabel className="flex items-center gap-2"><Smartphone className="h-4 w-4"/> Play Store (Android)</FormLabel>
                                <FormControl><Input {...field} placeholder="https://play.google.com/..." /></FormControl>
                            </FormItem>
                        )}/>
                    </CardContent>
                </Card>
            </div>
        </div>
      </form>
    </Form>
  );
}
