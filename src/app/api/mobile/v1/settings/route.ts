import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const apiKey = request.headers.get('x-api-key') || request.nextUrl.searchParams.get('apiKey');
        if (!apiKey) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const db = await getDb();
        const mobileSetting = await db.collection('settings').findOne({ _id: 'mobile' as any });
        if (!mobileSetting || !mobileSetting.apiKey || mobileSetting.apiKey !== apiKey) {
            return NextResponse.json({ error: 'Unauthorized - Invalid API Key' }, { status: 401 });
        }

        // Fetch general site settings
        const generalSettings = await db.collection('settings').findOne({ _id: 'general' as any });
        const siteUrl = generalSettings?.siteUrl || '';
        const emailLoginEnabled = generalSettings?.emailLoginEnabled !== false;
        const googleLoginEnabled = generalSettings?.googleLoginEnabled !== false;
        const facebookLoginEnabled = generalSettings?.facebookLoginEnabled === true;
        const appleLoginEnabled = generalSettings?.appleLoginEnabled === true;

        // Fetch coin packs
        const coinPacks = await db.collection('coin-packs').find({}).toArray();
        const mappedCoinPacks = coinPacks.map(cp => ({
            id: cp._id.toString(),
            name: cp.name || '',
            description: cp.description || '',
            amount: cp.type === 'membership' ? (cp.durationDays || 0) : (cp.amount || 0),
            price: cp.price || 0,
            type: cp.type || 'coins',
            googleProductId: cp.googleProductId || '',
            appleProductId: cp.appleProductId || ''
        }));

        // Fetch payment settings
        const paymentSettings = await db.collection('settings').findOne({ _id: 'payment' as any });
        const stripeEnabled = paymentSettings?.stripeEnabled === true;
        const paypalEnabled = paymentSettings?.paypalEnabled === true;
        const razorpayEnabled = paymentSettings?.razorpayEnabled === true;
        const googlePayEnabled = paymentSettings?.googlePayEnabled === true;

        // Fetch rewards settings and tasks
        const rewardsSettings = await db.collection('settings').findOne({ _id: 'rewards' as any });
        const rewardsEnabled = rewardsSettings?.isEnabled === true;
        const dailyRewards = rewardsSettings?.dailyRewards || [10, 15, 20, 25, 30, 40, 50];

        // Fetch video player ad watch limit
        const videoAd = await db.collection('ads').findOne({ _id: 'video_player_ad' as any });
        const admobRewardedLimit = mobileSetting?.admobRewardedLimit !== undefined
            ? Number(mobileSetting.admobRewardedLimit)
            : Number(videoAd?.dailyWatchLimit ?? 5);

        const languages = await db.collection('languages')
            .find({ $or: [{ isActive: true }, { isActive: { $exists: false } }] })
            .sort({ name: 1 })
            .toArray();
        const mappedLanguages = languages.map(language => ({
            id: language._id.toString(),
            name: language.name || '',
            languageCode: language.languageCode || '',
            countryCode: language.countryCode || ''
        }));

        const rewardTasks = await db.collection('reward-tasks').find({ platform: 'android', isActive: true }).toArray();
        const mappedRewardTasks = rewardTasks.map(t => ({
            id: t._id.toString(),
            title: t.title || '',
            type: t.type || 'link',
            coins: t.coins || 0,
            url: t.url || '',
            timerSeconds: t.timerSeconds || 0,
            frequency: t.frequency || 'daily'
        }));

        return NextResponse.json({
            siteUrl,
            emailLoginEnabled,
            googleLoginEnabled,
            facebookLoginEnabled,
            appleLoginEnabled,
            stripeEnabled,
            paypalEnabled,
            razorpayEnabled,
            googlePayEnabled,
            coinPacks: mappedCoinPacks,
            rewardsEnabled,
            dailyRewards,
            rewardTasks: mappedRewardTasks,
            privacyPolicyUrl: mobileSetting.privacyPolicyUrl || '',
            termsOfServiceUrl: mobileSetting.termsOfServiceUrl || '',
            rateUsUrl: mobileSetting.rateUsUrl || '',
            updateUrl: mobileSetting.updateUrl || '',
            versionCode: Number(mobileSetting.versionCode || 1),
            forceUpdateEnabled: mobileSetting.forceUpdateEnabled === true,
            languages: mappedLanguages,
            adsProvider: mobileSetting.adsProvider || 'admob',
            admobAppId: mobileSetting.admobAppId || '',
            admobBannerId: mobileSetting.admobBannerId || '',
            admobBannerEnabled: mobileSetting.admobBannerEnabled === true,
            admobInterstitialId: mobileSetting.admobInterstitialId || '',
            admobInterstitialEnabled: mobileSetting.admobInterstitialEnabled === true,
            admobRewardedId: mobileSetting.admobRewardedId || '',
            admobRewardedEnabled: mobileSetting.admobRewardedEnabled === true,
            admobRewardedLimit: admobRewardedLimit,
            applovinSdkKey: mobileSetting.applovinSdkKey || '',
            applovinBannerId: mobileSetting.applovinBannerId || '',
            applovinBannerEnabled: mobileSetting.applovinBannerEnabled === true,
            applovinInterstitialId: mobileSetting.applovinInterstitialId || '',
            applovinInterstitialEnabled: mobileSetting.applovinInterstitialEnabled === true,
            applovinRewardedId: mobileSetting.applovinRewardedId || '',
            applovinRewardedEnabled: mobileSetting.applovinRewardedEnabled === true,
            facebookBannerId: mobileSetting.facebookBannerId || '',
            facebookBannerEnabled: mobileSetting.facebookBannerEnabled === true,
            facebookInterstitialId: mobileSetting.facebookInterstitialId || '',
            facebookInterstitialEnabled: mobileSetting.facebookInterstitialEnabled === true,
            facebookRewardedId: mobileSetting.facebookRewardedId || '',
            facebookRewardedEnabled: mobileSetting.facebookRewardedEnabled === true
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
