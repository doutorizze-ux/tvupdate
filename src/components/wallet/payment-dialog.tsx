'use client';
import { useState, useMemo } from 'react';
import type { User } from 'firebase/auth';
import type { CoinPack, PaymentGatewaySettings, MonetizationSettings } from '@/lib/types';
import { createCheckoutSessionAction } from '@/lib/actions';
import Image from 'next/image';
import { cn } from '@/lib/utils';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Lock, ExternalLink, ShieldCheck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useTranslation } from '@/lib/translation-provider';

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pack: CoinPack;
  user: User;
  paymentSettings: PaymentGatewaySettings | null;
  monetizationSettings: MonetizationSettings | null;
  onPurchaseSuccess: () => void;
}

export function PaymentDialog({
  open, onOpenChange, pack, user, paymentSettings, monetizationSettings, onPurchaseSuccess
}: PaymentDialogProps) {
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [selectedGateway, setSelectedGateway] = useState<string>('');
  const { toast } = useToast();
  const { t } = useTranslation();

  const enabledGateways = useMemo(() => {
    if (!paymentSettings) return [];
    const gateways = [];
    if (paymentSettings.stripeEnabled) gateways.push('stripe');
    if (paymentSettings.paypalEnabled) gateways.push('paypal');
    if (paymentSettings.razorpayEnabled) gateways.push('razorpay');
    return gateways;
  }, [paymentSettings]);

  const defaultTab = useMemo(() => {
    return enabledGateways[0] || '';
  }, [enabledGateways]);

  const validateKeys = (gateway: string) => {
      if (gateway === 'stripe') {
          return !!paymentSettings?.stripePublishableKey;
      }
      if (gateway === 'paypal') {
          return !!paymentSettings?.paypalClientId;
      }
      return !!paymentSettings?.razorpayKeyId;
  };

  const handleRedirectToPay = async () => {
    const gateway = selectedGateway || defaultTab;
    
    if (!validateKeys(gateway)) {
        toast({
            variant: 'destructive',
            title: 'Config Error',
            description: `Invalid or missing Keys for ${gateway.toUpperCase()}. Please check your Admin settings.`,
        });
        return;
    }

    setIsRedirecting(true);
    
    try {
        const result = await createCheckoutSessionAction(user.uid, pack.id, gateway);
        
        if (result.success && result.url) {
            window.location.href = result.url;
        } else {
            throw new Error(result.error || 'Could not create checkout session.');
        }
    } catch (error: any) {
        setIsRedirecting(false);
        toast({
            variant: 'destructive',
            title: 'Redirect Failed',
            description: error.message,
        });
    }
  };

  if (enabledGateways.length === 0) {
      return null;
  }

  const symbol = monetizationSettings?.currencySymbol || '$';
  const price = pack.price.toFixed(2);
  const currentTab = selectedGateway || defaultTab;

  const getGatewayLogo = (gateway: string) => {
      if (gateway === 'stripe') return paymentSettings?.stripeLogoUrl || '/img/logo-stripe.svg';
      if (gateway === 'paypal') return paymentSettings?.paypalLogoUrl || '/img/logo-paypal.svg';
      if (gateway === 'razorpay') return paymentSettings?.razorpayLogoUrl || '/img/logo-razorpay.svg';
      return '/img/logo-stripe.svg';
  }

  // To prevent caching during logo updates in admin, add a timestamp
  const logoUrl = getGatewayLogo(currentTab);
  const finalLogoUrl = logoUrl.startsWith('/') ? `${logoUrl}?v=${Date.now()}` : logoUrl;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-zinc-950 border-white/5 text-white p-0 overflow-hidden rounded-[2.5rem]">
        <DialogHeader className="px-6 pt-8 md:pt-10">
          <DialogTitle className="text-2xl md:text-3xl font-black italic tracking-tighter uppercase text-center leading-none">
              {isRedirecting ? 'Transferring...' : t('payment_dialog_title')}
          </DialogTitle>
          <DialogDescription className="text-white/40 font-bold uppercase tracking-widest text-[9px] md:text-[10px] text-center mt-2">
            {isRedirecting 
                ? "Please wait while we transfer you to the secure payment page."
                : t('payment_dialog_desc', { packName: pack.name, symbol, price })
            }
          </DialogDescription>
        </DialogHeader>
        
        <div className="p-4 md:p-6">
            {isRedirecting ? (
                <div className="flex flex-col items-center justify-center py-12 md:py-16 space-y-6">
                    <div className="relative">
                        <Loader2 className="h-16 w-10 md:h-20 md:w-12 animate-spin text-primary" />
                        <ShieldCheck className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-5 w-5 md:h-6 md:w-6 text-white" />
                    </div>
                    <p className="font-black text-[10px] uppercase tracking-[0.3em] text-white/40 animate-pulse">Establishing Secure Link...</p>
                </div>
            ) : (
                <>
                    <Tabs defaultValue={defaultTab} onValueChange={setSelectedGateway} className="w-full">
                        <TabsList className={cn("grid w-full h-14 md:h-16 bg-white/5 border border-white/5 p-1 rounded-2xl", `grid-cols-${enabledGateways.length}`)}>
                            {paymentSettings?.stripeEnabled && (
                                <TabsTrigger value="stripe" className="rounded-xl data-[state=active]:bg-primary flex items-center justify-center gap-2 h-full transition-all">
                                    <div className="relative h-4 w-4 md:h-5 md:w-5">
                                        <Image 
                                            src={getGatewayLogo('stripe')} 
                                            alt="Stripe" 
                                            fill 
                                            className={cn("object-contain", !paymentSettings?.stripeLogoUrl && "brightness-0 invert")} 
                                        />
                                    </div>
                                    <span className="text-[9px] md:text-[10px] font-black uppercase tracking-tighter">Stripe</span>
                                </TabsTrigger>
                            )}
                            {paymentSettings?.paypalEnabled && (
                                <TabsTrigger value="paypal" className="rounded-xl data-[state=active]:bg-primary flex items-center justify-center gap-2 h-full transition-all">
                                    <div className="relative h-4 w-4 md:h-5 md:w-5">
                                        <Image 
                                            src={getGatewayLogo('paypal')} 
                                            alt="PayPal" 
                                            fill 
                                            className={cn("object-contain", !paymentSettings?.paypalLogoUrl && "brightness-0 invert")} 
                                        />
                                    </div>
                                    <span className="text-[9px] md:text-[10px] font-black uppercase tracking-tighter">PayPal</span>
                                </TabsTrigger>
                            )}
                            {paymentSettings?.razorpayEnabled && (
                                <TabsTrigger value="razorpay" className="rounded-xl data-[state=active]:bg-primary flex items-center justify-center gap-2 h-full transition-all">
                                    <div className="relative h-4 w-4 md:h-5 md:w-5">
                                        <Image 
                                            src={getGatewayLogo('razorpay')} 
                                            alt="Razorpay" 
                                            fill 
                                            className={cn("object-contain", !paymentSettings?.razorpayLogoUrl && "brightness-0 invert")} 
                                        />
                                    </div>
                                    <span className="text-[9px] md:text-[10px] font-black uppercase tracking-tighter">Razorpay</span>
                                </TabsTrigger>
                            )}
                        </TabsList>
                        
                        <div className="mt-6 md:mt-8">
                            <Card className="border-none bg-white/[0.03] rounded-[2rem] md:rounded-[3rem] overflow-hidden shadow-2xl relative group">
                                <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                <CardContent className="pt-8 pb-8 md:pt-12 md:pb-10 text-center space-y-6 md:space-y-8 relative z-10">
                                    <div className="h-28 w-28 md:h-40 md:w-40 bg-zinc-900 rounded-[2.5rem] md:rounded-[3.5rem] flex items-center justify-center mx-auto border border-white/5 shadow-2xl relative overflow-hidden group-hover:scale-105 transition-transform duration-500">
                                        <div className="absolute inset-0 bg-primary/10 blur-2xl rounded-full" />
                                        <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
                                            <Image 
                                                src={finalLogoUrl} 
                                                alt={currentTab} 
                                                fill
                                                className="object-cover transition-all duration-700" 
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <p className="text-sm md:text-lg font-black uppercase tracking-widest text-white leading-tight">
                                            {t(`payment_dialog_${currentTab}_redirect`) || `Securing ${currentTab} Link...`}
                                        </p>
                                        <p className="text-[8px] md:text-[10px] text-white/30 italic font-bold uppercase tracking-[0.2em]">
                                            {currentTab === 'stripe' && "Official Secure Checkout"}
                                            {currentTab === 'paypal' && "Safe and Fast Global Payments"}
                                            {currentTab === 'razorpay' && "Indian Secure Gateway"}
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </Tabs>

                    <div className="flex flex-col gap-3 md:gap-4 mt-6 md:mt-8 pb-4">
                        <Button onClick={handleRedirectToPay} className="w-full h-16 md:h-20 bg-primary hover:bg-primary/90 font-black uppercase tracking-[0.2em] shadow-2xl shadow-primary/30 rounded-[1.5rem] md:rounded-[2rem] text-sm md:text-lg group overflow-hidden relative">
                            <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
                            <ExternalLink className="mr-3 h-5 w-5 md:h-6 md:w-6 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform relative z-10" />
                            <span className="relative z-10">{t('payment_dialog_button_pay_now')}</span>
                        </Button>
                        <Button variant="ghost" onClick={() => onOpenChange(false)} className="w-full h-10 md:h-12 rounded-xl font-black uppercase tracking-widest text-white/20 hover:text-white hover:bg-white/5 text-[9px] md:text-[10px]">
                            {t('common_cancel')}
                        </Button>
                    </div>
                </>
            )}
        </div>

        <div className="bg-white/[0.02] py-3 md:py-4 px-6 flex items-center justify-center gap-3 border-t border-white/5 opacity-30">
            <ShieldCheck className="h-3 w-3 md:h-4 md:w-4" />
            <span className="text-[8px] md:text-[9px] font-black uppercase tracking-[0.3em]">SSL 256-BIT ENCRYPTED TRANSACTION</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
