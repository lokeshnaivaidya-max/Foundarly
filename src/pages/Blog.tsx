import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AnimatedSection from "@/components/AnimatedSection";
import { SkeletonGrid } from "@/components/PageLoader";
import { blogService } from "@/services/blog";

interface BlogPost {
  id: string;
  title: string;
  content: string;
  featured_image: string | null;
  meta_title: string | null;
  meta_description: string | null;
  status: 'published' | 'draft';
  created_at: string;
}

export default function BlogPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPosts();
  }, []);

  const loadPosts = async () => {
    try {
      const data = await blogService.getAll(true); // Only published posts
      setPosts(data);
    } catch (error) {
      console.error('Error loading blog posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getExcerpt = (content: string, maxLength: number = 150) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength).trim() + '...';
  };
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-28 pb-24">
        <div className="container mx-auto px-6">
          <AnimatedSection className="text-center mb-16">
            <p className="text-primary text-sm font-semibold tracking-[0.15em] uppercase mb-3">Insights</p>
            <h1 className="font-display text-4xl md:text-5xl font-bold">The Foundarly <span className="text-gradient-gold">Journal</span></h1>
            <p className="mt-4 text-muted-foreground max-w-xl mx-auto">Ideas and frameworks from the leaders shaping tomorrow.</p>
          </AnimatedSection>

          {loading ? (
            <SkeletonGrid count={4} cols={2} />
          ) : posts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>No blog posts available yet.</p>
              <p className="text-sm mt-2">Check back soon for insights and updates.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              {posts.map((post, i) => (
                <AnimatedSection key={post.id} delay={i * 0.1}>
                  <Link to={`/blog/${post.id}`}>
                    <article className="group bg-gradient-card border border-border rounded-lg overflow-hidden hover:border-primary/30 transition-all duration-500 hover:-translate-y-1 cursor-pointer">
                      {post.featured_image && (
                        <div className="aspect-video overflow-hidden">
                          <img 
                            src={post.featured_image} 
                            alt={post.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        </div>
                      )}
                      <div className="p-6">
                        <h2 className="font-display text-xl font-semibold mb-2 group-hover:text-primary transition-colors">
                          {post.title}
                        </h2>
                        <p className="text-sm text-muted-foreground mb-4">
                          {getExcerpt(post.content)}
                        </p>
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-muted-foreground">{formatDate(post.created_at)}</p>
                          <span className="text-xs text-primary group-hover:text-primary/80 transition-colors">
                            Read more →
                          </span>
                        </div>
                      </div>
                    </article>
                  </Link>
                </AnimatedSection>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
