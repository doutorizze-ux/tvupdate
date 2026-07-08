import { getSeriesBySlugOrId, getEpisodesForSeries } from '@/lib/data';
import type { Metadata } from 'next';
import { SeriesDetailView } from '@/components/series-detail-view';
import { notFound } from 'next/navigation';
import { getSecureVideoUrl } from '@/lib/actions';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const series = await getSeriesBySlugOrId(id);

  if (!series) {
    return {
      title: 'Not Found',
      description: 'This series does not exist.',
    };
  }

  return {
    title: series.seoTitle || series.title,
    description: series.metaDescription || series.description,
    keywords: series.metaKeywords || series.genres,
  };
}

export default async function SeriesDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const series = await getSeriesBySlugOrId(id);
    if (!series) {
        notFound();
    }

    const episodes = await getEpisodesForSeries(series.id);
    let initialVideoUrl = '';

    if (episodes.length > 0 && episodes[0].videoSources && episodes[0].videoSources.length > 0) {
        const rawUrl = episodes[0].videoSources[0].url;
        initialVideoUrl = await getSecureVideoUrl(rawUrl);
    }

    return (
        <SeriesDetailView 
            key={series.id} 
            initialSeries={series} 
            initialEpisodes={episodes}
            initialVideoUrl={initialVideoUrl}
        />
    );
}
