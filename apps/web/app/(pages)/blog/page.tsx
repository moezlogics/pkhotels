 //import Navbar from '@/components/NavBar';
import BlogGrid from '@/components/BlogGrid';  // ← BlogSection ki jagah BlogGrid
//import Footer from '@/components/Footer';

export const metadata = {
  title: "Pakistan Travel Blog — Hotel Guides & Trip Tips | PakHotels",
  description: "Travel guides for Pakistan: where to stay in Lahore, Islamabad, Murree, Karachi and the north, hotel tips, best areas, prices and things to do.",
  alternates: { canonical: "/blog" },
};

export default function BlogPage() {
  return (
    <div className="min-h-screen">
      
      {/* Blog Page Header */}
      <div className="pt-8 pb-8 bg-neutral-50 border-b border-border">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl md:text-5xl font-semibold text-foreground mb-4">
            Pakistan Real Estate Blog
          </h1>
          <p className="text-lg text-muted-foreground">
            Make smarter property decisions in Pakistan. Read the latest market trends, price updates, area guides, and expert tips on buying, selling, and renting real estate.
          </p>
        </div>
      </div>
      
      <BlogGrid />   
      
    </div>
  );
}