'use client';
import { useMemo, useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import type { Episode, Series, StorageSettings } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PlusCircle, Edit, Trash2, Plus, Trash, Loader2, Save, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getEpisodesForSeries, getSeriesById, getStorageSettings } from '@/lib/data.actions';
import { saveEpisodeAction, deleteEpisodeAction } from '@/lib/actions';

interface VideoSourceState {
    key: string;
    quality: string;
    sourceType: 'upload' | 'link' | 'embed';
    url: string;
    file: File | null;
    uploadProgress: number;
    status: 'idle' | 'uploading' | 'error' | 'done';
}

interface EpisodeState {
    id?: string;
    key: string;
    episodeInSeason: number;
    sources: VideoSourceState[];
}

function EpisodeDialog({ seriesId, episodeToEdit, children, nextEpisodeNumber, onSaved }: { seriesId: string, episodeToEdit?: Episode | null, children: React.ReactNode, nextEpisodeNumber: number, onSaved: () => void }) {
    const { toast } = useToast();
    const [isOpen, setIsOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [episodes, setEpisodes] = useState<EpisodeState[]>([]);
    const [storageSettings, setStorageSettings] = useState<StorageSettings | null>(null);

    const isEditMode = !!episodeToEdit;

    const createNewSource = (quality = '720p', url = '', sourceType: 'upload' | 'link' | 'embed' = 'upload'): VideoSourceState => ({
        key: `source-${Date.now()}-${Math.random()}`,
        quality,
        sourceType,
        url,
        file: null,
        uploadProgress: 0,
        status: 'idle',
    });

    const createNewEpisode = (episodeNumber: number): EpisodeState => ({
        key: `episode-${Date.now()}-${Math.random()}`,
        episodeInSeason: episodeNumber,
        sources: [createNewSource()],
    });

    useEffect(() => {
        if (isOpen) {
            getStorageSettings().then(setStorageSettings);
            if (isEditMode && episodeToEdit) {
                const sources = (episodeToEdit.videoSources && episodeToEdit.videoSources.length > 0)
                    ? episodeToEdit.videoSources.map(s => {
                        const isEmbedCode = s.url.includes('<iframe');
                        return createNewSource(s.quality, s.url, isEmbedCode ? 'embed' : 'link');
                      })
                    : [createNewSource()];
                
                setEpisodes([{
                    id: episodeToEdit.id,
                    key: `episode-${episodeToEdit.id}`,
                    episodeInSeason: episodeToEdit.episodeInSeason,
                    sources: sources,
                }]);
            } else {
                setEpisodes([createNewEpisode(nextEpisodeNumber)]);
            }
        }
    }, [isOpen, episodeToEdit, isEditMode, nextEpisodeNumber]);

    const handleEpisodeChange = (epIndex: number, field: 'episodeInSeason', value: any) => {
        const newEpisodes = [...episodes];
        if (newEpisodes[epIndex]) {
            newEpisodes[epIndex][field] = value;
            setEpisodes(newEpisodes);
        }
    };

    const handleSourceChange = (epIndex: number, srcIndex: number, field: keyof VideoSourceState, value: any) => {
        const newEpisodes = [...episodes];
        const source = newEpisodes[epIndex]?.sources[srcIndex];
        if (source) {
            (source[field] as any) = value;
            if (field === 'sourceType') {
                source.url = '';
                source.file = null;
                source.uploadProgress = 0;
                source.status = 'idle';
            }
            setEpisodes(newEpisodes);
        }
    };

    const addEpisodeForm = () => {
        const lastEpNum = episodes.length > 0 ? episodes[episodes.length - 1].episodeInSeason : nextEpisodeNumber - 1;
        setEpisodes(prev => [...prev, createNewEpisode(lastEpNum + 1)]);
    };

    const removeEpisodeForm = (epIndex: number) => {
        setEpisodes(prev => prev.filter((_, i) => i !== epIndex));
    };

    const addSourceForm = (epIndex: number) => {
        const newEpisodes = [...episodes];
        if (newEpisodes[epIndex]) {
            newEpisodes[epIndex].sources.push(createNewSource());
            setEpisodes(newEpisodes);
        }
    };

    const removeSourceForm = (epIndex: number, srcIndex: number) => {
        const newEpisodes = [...episodes];
        if (newEpisodes[epIndex] && newEpisodes[epIndex].sources.length > 1) {
            newEpisodes[epIndex].sources = newEpisodes[epIndex].sources.filter((_, i) => i !== srcIndex);
            setEpisodes(newEpisodes);
        }
    };

    const handleSaveChanges = async () => {
        setIsSaving(true);
        const filesToUpload: { epIndex: number; srcIndex: number; file: File }[] = [];
        episodes.forEach((ep, epIndex) => {
            ep.sources.forEach((source, srcIndex) => {
                if (source.sourceType === 'upload' && source.file && source.status !== 'done') {
                    filesToUpload.push({ epIndex, srcIndex, file: source.file });
                }
            });
        });

        const episodesWithUrls = JSON.parse(JSON.stringify(episodes));

        try {
            for (const { epIndex, srcIndex, file } of filesToUpload) {
                 handleSourceChange(epIndex, srcIndex, 'status', 'uploading');
                 const url = await new Promise<string>((resolve, reject) => {
                     const xhr = new XMLHttpRequest();
                     const formData = new FormData();
                     formData.append('file', file);

                     xhr.upload.onprogress = (event) => {
                         if (event.lengthComputable) {
                             const percent = (event.loaded / event.total) * 100;
                              handleSourceChange(epIndex, srcIndex, 'uploadProgress', percent);
                         }
                     };

                     xhr.onload = () => {
                         if (xhr.status >= 200 && xhr.status < 300) {
                             const res = JSON.parse(xhr.responseText);
                             resolve(res.url);
                         } else {
                            try {
                                const res = JSON.parse(xhr.responseText);
                                reject(new Error(res.error || 'Upload failed'));
                            } catch {
                                reject(new Error('Upload failed'));
                            }
                         }
                     };
                     xhr.onerror = () => reject(new Error('Network error during upload.'));
                     xhr.open('POST', '/api/upload', true);
                     xhr.send(formData);
                 });
                 episodesWithUrls[epIndex].sources[srcIndex].url = url;
                 handleSourceChange(epIndex, srcIndex, 'status', 'done');
             }

            for (const episodeState of episodesWithUrls) {
                const videoSources = episodeState.sources
                    .filter((s: any) => s.url)
                    .map((s: any) => ({ quality: s.quality, url: s.url }));

                if (videoSources.length === 0 && !isEditMode) continue;
                
                const result = await saveEpisodeAction({
                    id: episodeState.id,
                    seriesId,
                    episodeInSeason: episodeState.episodeInSeason,
                    videoSources: videoSources,
                });
                if (!result.success) {
                    throw new Error(result.error || 'Failed to save episode.');
                }
            }
            
            toast({ title: "Success" });
            setIsOpen(false);
            onSaved();
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Save Failed', description: error.message });
        } finally {
            setIsSaving(false);
        }
    };
    
    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent className="sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle>{isEditMode ? `Edit Episode ${episodeToEdit?.episodeInSeason}` : 'Add New Episodes'}</DialogTitle>
                </DialogHeader>
                <ScrollArea className="max-h-[70vh] pr-6 -mr-2">
                <div className="space-y-4 py-4">
                    {episodes.map((episode, epIndex) => (
                        <Card key={episode.key} className="p-4 space-y-4 relative">
                            {!isEditMode && (
                                <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 h-7 w-7" onClick={() => removeEpisodeForm(epIndex)}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                            )}
                             <div className="space-y-2">
                                <Label>Episode Number</Label>
                                <Input type="number" value={episode.episodeInSeason} onChange={(e) => handleEpisodeChange(epIndex, 'episodeInSeason', Number(e.target.value))} className="w-24" />
                             </div>
                             <div className="space-y-3 pl-4 border-l">
                                 {episode.sources.map((source, srcIndex) => (
                                     <div key={source.key} className="p-3 border rounded-lg space-y-3 bg-card/50">
                                         <div className="flex justify-between items-center">
                                             <p className="text-xs font-semibold text-muted-foreground">Quality Source #{srcIndex + 1}</p>
                                             <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeSourceForm(epIndex, srcIndex)}>
                                                 <Trash className="h-4 w-4 text-destructive/70" />
                                             </Button>
                                         </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label>Quality</Label>
                                                <Select value={source.quality} onValueChange={(value) => handleSourceChange(epIndex, srcIndex, 'quality', value)}>
                                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="1080p">1080p</SelectItem>
                                                        <SelectItem value="720p">720p</SelectItem>
                                                        <SelectItem value="480p">480p</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                             <div className="space-y-2">
                                                <Label>Source Type</Label>
                                                <Select value={source.sourceType} onValueChange={(val: any) => handleSourceChange(epIndex, srcIndex, 'sourceType', val)}>
                                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="upload">Upload</SelectItem>
                                                        <SelectItem value="link">Direct Link</SelectItem>
                                                        <SelectItem value="embed">Embed Code</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                             </div>
                                        </div>
                                         <div className="space-y-2">
                                             {source.sourceType === 'upload' ? (
                                                <Input type="file" accept=".mp4" onChange={(e) => handleSourceChange(epIndex, srcIndex, 'file', e.target.files ? e.target.files[0] : null)} />
                                             ) : source.sourceType === 'link' ? (
                                                <Input value={source.url} onChange={(e) => handleSourceChange(epIndex, srcIndex, 'url', e.target.value)} placeholder="https://.../video.mp4" />
                                             ) : (
                                                <Textarea value={source.url} onChange={(e) => handleSourceChange(epIndex, srcIndex, 'url', e.target.value)} placeholder="<iframe>...</iframe>" />
                                             )}
                                         </div>
                                         {source.sourceType === 'upload' && source.file && source.status !== 'done' && (
                                            <div className="space-y-2">
                                                <Progress value={source.uploadProgress} />
                                                <p className="text-xs text-muted-foreground truncate">{source.file.name} - {source.status === 'uploading' ? `${Math.round(source.uploadProgress)}%` : 'Pending...'}</p>
                                            </div>
                                        )}
                                     </div>
                                 ))}
                             </div>
                            <Button type="button" variant="outline" size="sm" onClick={() => addSourceForm(epIndex)}><Plus size={16} className="mr-2" /> Add Quality</Button>
                        </Card>
                    ))}
                    {!isEditMode && <Button type="button" variant="secondary" onClick={addEpisodeForm} className="w-full"><Plus className="mr-2 h-4 w-4" /> Add Another Episode</Button>}
                </div>
                </ScrollArea>
                <DialogFooter>
                    <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                    <Button onClick={handleSaveChanges} disabled={isSaving}>{isSaving ? <Loader2 className="animate-spin" /> : <Save />}Save Changes</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default function SeriesEpisodesPage() {
  const params = useParams() as any;
  const seriesId = params.id;
  const { toast } = useToast();

  const [series, setSeries] = useState<Series | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    if (!seriesId) return;
    setLoading(true);
    const [seriesData, episodesData] = await Promise.all([getSeriesById(seriesId), getEpisodesForSeries(seriesId)]);
    setSeries(seriesData);
    setEpisodes(episodesData.sort((a, b) => a.episodeInSeason - b.episodeInSeason));
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [seriesId]);

  const nextEpisodeNumber = useMemo(() => {
      if (episodes.length === 0) return 1;
      return Math.max(...episodes.map(e => e.episodeInSeason)) + 1;
  }, [episodes]);

  if (!seriesId) return <div>Invalid ID</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
           {loading ? <Skeleton className="h-9 w-64" /> : <h1 className="text-3xl font-bold">Episodes for "{series?.title}"</h1>}
        </div>
        <EpisodeDialog seriesId={seriesId} nextEpisodeNumber={nextEpisodeNumber} onSaved={fetchData}>
            <Button disabled={loading}><PlusCircle className="mr-2 h-4 w-4" /> Add New Episode</Button>
        </EpisodeDialog>
      </div>

      <Card>
        <CardHeader><CardTitle>All Episodes ({episodes?.length || 0})</CardTitle></CardHeader>
        <CardContent>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[100px]">Episode</TableHead>
                        <TableHead>Video Sources</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                {loading ? Array.from({length: 3}).map((_, i) => (
                    <TableRow key={i}>
                        <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-64" /></TableCell>
                        <TableCell className="text-right"><div className="flex justify-end gap-2"><Skeleton className="h-8 w-8" /><Skeleton className="h-8 w-8" /></div></TableCell>
                    </TableRow>
                )) : episodes?.map((item) => (
                    <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.episodeInSeason}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{item.videoSources?.map(s => `[${s.quality}]`).join(' ') || 'No sources'}</TableCell>
                        <TableCell className="text-right">
                           <div className="inline-flex gap-1">
                                <EpisodeDialog seriesId={seriesId} episodeToEdit={item} nextEpisodeNumber={nextEpisodeNumber} onSaved={fetchData}>
                                    <Button variant="ghost" size="icon"><Edit className="h-4 w-4" /></Button>
                                </EpisodeDialog>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle></AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction onClick={async () => {
                                                const result = await deleteEpisodeAction(item.id, seriesId);
                                                if (result.success) {
                                                    toast({ title: 'Episode Deleted' });
                                                    fetchData();
                                                } else {
                                                    toast({ variant: 'destructive', title: 'Delete Failed', description: result.error });
                                                }
                                            }} className="bg-destructive hover:bg-destructive/90">Continue</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        </TableCell>
                    </TableRow>
                ))}
                </TableBody>
            </Table>
        </CardContent>
      </Card>
    </div>
  );
}
