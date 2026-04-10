'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Newspaper, Globe, IndianRupee, Cpu, TrendingUp, Search, RefreshCw, ChevronLeft, ChevronRight, ExternalLink, Clock } from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Article {
  id: string;
  title: string;
  url: string;
  source: string;
  sourceDomain: string;
  description: string;
  imageUrl: string;
  author: string;
  publishedAt: string;
  category: string;
  region: string;
}

interface NewsResponse {
  success: boolean;
  articles: Article[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
  sources: Record<string, number>;
}

const categories = [
  { id: '', label: 'All News', icon: Globe },
  { id: 'india', label: 'India', icon: IndianRupee },
  { id: 'technology', label: 'Technology', icon: Cpu },
  { id: 'trending', label: 'Trending', icon: TrendingUp },
];

function ArticleCardSkeleton() {
  return (
    <div className="rounded-xl border border-[#2a2a2a] bg-[#141414] p-5 animate-pulse">
      <div className="flex justify-between items-start mb-3">
        <div className="h-4 w-20 bg-[#2a2a2a] rounded" />
        <div className="h-4 w-16 bg-[#2a2a2a] rounded" />
      </div>
      <div className="h-6 w-full bg-[#2a2a2a] rounded mb-2" />
      <div className="h-6 w-3/4 bg-[#2a2a2a] rounded mb-3" />
      <div className="h-4 w-full bg-[#2a2a2a] rounded mb-1" />
      <div className="h-4 w-2/3 bg-[#2a2a2a] rounded mb-4" />
      <div className="flex justify-between">
        <div className="h-3 w-24 bg-[#2a2a2a] rounded" />
        <div className="h-3 w-16 bg-[#2a2a2a] rounded" />
      </div>
    </div>
  );
}

function ArticleCard({ article, index }: { article: Article; index: number }) {
  const timeAgo = getTimeAgo(article.publishedAt);
  const sourceColor = getSourceColor(article.source);

  return (
    <motion.a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className="group block rounded-xl border border-[#2a2a2a] bg-[#141414] p-5 transition-all hover:border-[#D4AF37]/50 hover:shadow-lg hover:shadow-[#D4AF37]/5"
    >
      <div className="flex justify-between items-start mb-3">
        <Badge
          variant="outline"
          className={`text-xs ${sourceColor} border-current`}
        >
          {article.sourceDomain || article.source}
        </Badge>
        {article.region === 'IN' && (
          <Badge variant="outline" className="text-xs text-orange-400 border-orange-400/50">
            🇮🇳 India
          </Badge>
        )}
      </div>

      <h3 className="text-lg font-semibold text-[#f5f5f0] mb-2 line-clamp-2 group-hover:text-[#D4AF37] transition-colors">
        {article.title}
      </h3>

      {article.description && (
        <p className="text-sm text-[#a0a0a0] mb-4 line-clamp-2">
          {article.description}
        </p>
      )}

      <div className="flex items-center justify-between text-xs text-[#666]">
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          <span>{timeAgo}</span>
        </div>
        <div className="flex items-center gap-1 text-[#D4AF37] opacity-0 group-hover:opacity-100 transition-opacity">
          <span>Read</span>
          <ExternalLink className="h-3 w-3" />
        </div>
      </div>
    </motion.a>
  );
}

function getTimeAgo(dateStr: string): string {
  try {
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diff = now - then;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  } catch {
    return '';
  }
}

function getSourceColor(source: string): string {
  switch (source) {
    case 'GDELT': return 'text-blue-400';
    case 'RSS': return 'text-green-400';
    case 'HackerNews': return 'text-orange-400';
    default: return 'text-[#D4AF37]';
  }
}

function HomeContent() {
  const searchParams = useSearchParams();
  const regionParam = searchParams.get('region') || '';
  const categoryParam = searchParams.get('category') || '';

  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sources, setSources] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState(categoryParam || '');

  const fetchNews = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', '20');

      if (searchQuery) params.set('query', searchQuery);
      if (regionParam) params.set('region', regionParam);
      if (activeCategory === 'india') {
        params.set('category', 'india');
        params.set('region', 'IN');
      } else if (activeCategory) {
        params.set('query', activeCategory);
      }

      const res = await fetch(`${API_BASE}/api/v1/news?${params.toString()}`);
      const data: NewsResponse = await res.json();

      if (data.success) {
        setArticles(data.articles);
        setTotalPages(data.pagination.totalPages);
        setSources(data.sources);
      } else {
        setError('Failed to load news');
      }
    } catch {
      setError('Unable to connect to news service');
    } finally {
      setLoading(false);
    }
  }, [page, searchQuery, regionParam, activeCategory]);

  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

  useEffect(() => {
    setActiveCategory(categoryParam || '');
    setPage(1);
  }, [categoryParam, regionParam]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchNews();
  };

  const handleCategoryChange = (catId: string) => {
    setActiveCategory(catId);
    setPage(1);
  };

  return (
    <>
      <Header />
      <main className="flex-1 bg-[#0a0a0a]">
        {/* Hero Section */}
        <section className="relative overflow-hidden border-b border-[#2a2a2a]">
          <div className="absolute inset-0 bg-gradient-to-b from-[#D4AF37]/5 to-transparent" />
          <div className="container relative mx-auto px-4 py-12 md:py-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mx-auto max-w-3xl text-center"
            >
              <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
                <span className="bg-gradient-to-r from-[#D4AF37] to-[#F0D060] bg-clip-text text-transparent">
                  NewsHub
                </span>
              </h1>
              <p className="mb-8 text-lg text-[#a0a0a0] md:text-xl">
                Fresh, diverse news from multiple sources — updated every few minutes
              </p>

              {/* Search */}
              <form onSubmit={handleSearch} className="mx-auto max-w-lg flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#666]" />
                  <Input
                    type="text"
                    placeholder="Search news..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-[#141414] border-[#2a2a2a] text-[#f5f5f0] placeholder:text-[#666] focus:border-[#D4AF37] focus:ring-[#D4AF37]/20"
                  />
                </div>
                <Button type="submit" className="bg-[#D4AF37] text-black hover:bg-[#F0D060] font-medium">
                  Search
                </Button>
              </form>

              {/* Source Stats */}
              {Object.keys(sources).length > 0 && (
                <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-xs text-[#666]">
                  {Object.entries(sources).map(([source, count]) => (
                    <span key={source} className="flex items-center gap-1">
                      <span className={`h-2 w-2 rounded-full ${source === 'GDELT' ? 'bg-blue-400' : source === 'RSS' ? 'bg-green-400' : 'bg-orange-400'}`} />
                      {source}: {count}
                    </span>
                  ))}
                </div>
              )}
            </motion.div>
          </div>
        </section>

        {/* Category Tabs */}
        <section className="border-b border-[#2a2a2a] bg-[#0f0f0f]">
          <div className="container mx-auto px-4">
            <div className="flex items-center gap-1 overflow-x-auto py-3 scrollbar-hide">
              {categories.map((cat) => {
                const Icon = cat.icon;
                const isActive = activeCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => handleCategoryChange(cat.id)}
                    className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-[#D4AF37] text-black'
                        : 'text-[#a0a0a0] hover:bg-[#1a1a1a] hover:text-[#D4AF37]'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {cat.label}
                  </button>
                );
              })}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setPage(1); fetchNews(); }}
                className="ml-auto text-[#a0a0a0] hover:text-[#D4AF37] hover:bg-[#1a1a1a]"
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Refresh
              </Button>
            </div>
          </div>
        </section>

        {/* News Grid */}
        <section className="container mx-auto px-4 py-8">
          {error && (
            <div className="rounded-xl border border-red-900/50 bg-red-950/30 p-6 text-center mb-8">
              <p className="text-red-400">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchNews}
                className="mt-3 border-red-800 text-red-400 hover:bg-red-950"
              >
                Try Again
              </Button>
            </div>
          )}

          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 9 }).map((_, i) => (
                <ArticleCardSkeleton key={i} />
              ))}
            </div>
          ) : articles.length > 0 ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {articles.map((article, index) => (
                  <ArticleCard key={article.id} article={article} index={index} />
                ))}
              </div>

              {/* Pagination */}
              <div className="mt-8 flex items-center justify-center gap-4">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="border-[#2a2a2a] text-[#a0a0a0] hover:border-[#D4AF37] hover:text-[#D4AF37] disabled:opacity-30"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <span className="text-sm text-[#a0a0a0]">
                  Page {page} of {totalPages || 1}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="border-[#2a2a2a] text-[#a0a0a0] hover:border-[#D4AF37] hover:text-[#D4AF37] disabled:opacity-30"
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#1a1a1a]">
                <Newspaper className="h-8 w-8 text-[#D4AF37]" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-[#f5f5f0]">No articles found</h3>
              <p className="text-[#a0a0a0]">
                Try adjusting your search or changing categories
              </p>
            </div>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-[#0a0a0a]">
        <div className="text-[#D4AF37] text-xl">Loading...</div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}
