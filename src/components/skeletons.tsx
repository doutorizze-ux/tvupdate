import { Skeleton } from '@/components/ui/skeleton';

export const SeriesCarouselSkeleton = ({ title }: { title?: string }) => (
  <div className="space-y-6">
    {title && (
        <div className="flex items-center gap-3">
            <div className="w-1.5 h-6 bg-primary rounded-full" />
            <h2 className="text-2xl font-bold">{title}</h2>
        </div>
    )}
    <div className="flex space-x-4 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="basis-1/2 sm:basis-1/3 md:basis-1/4 lg:basis-1/5 xl:basis-1/6 flex-shrink-0 space-y-3">
            <Skeleton className="aspect-[2/3] rounded-xl bg-card/80" />
            <Skeleton className="h-4 w-3/4 bg-card/40" />
        </div>
        ))}
    </div>
  </div>
);

export const SeriesGridSkeleton = () => (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-4 gap-y-8">
    {Array.from({ length: 12 }).map((_, i) => (
      <div key={i} className="space-y-3">
        <Skeleton className="aspect-[2/3] rounded-xl bg-card/80" />
        <Skeleton className="h-4 w-3/4 bg-card/40" />
      </div>
    ))}
    </div>
);

export const HomeLoadingSkeleton = () => (
    <div className="flex flex-col gap-12 pb-20">
        {/* Hero Skeleton */}
        <Skeleton className="h-[65vh] w-full bg-card/20 rounded-none" />
        
        <div className="container mx-auto px-4 space-y-12">
            <SeriesCarouselSkeleton title="New Release" />
            <SeriesCarouselSkeleton title="Trending Now" />
            <SeriesCarouselSkeleton title="Recommended for You" />
        </div>
    </div>
);
