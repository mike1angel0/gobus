import { Bus, Shield, Clock } from 'lucide-react';
import { SearchForm } from '@/components/search/search-form';
import { usePageTitle } from '@/hooks/use-page-title';

/**
 * Home page with hero section, search form, and feature highlights.
 * The search form navigates to /search with origin, destination, and date query params.
 */
export default function HomePage() {
  usePageTitle('Home');

  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative flex min-h-[70vh] items-center justify-center px-4 py-20">
        <div className="mx-auto w-full max-w-4xl text-center">
          <h1 className="mb-4 text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
            Travel smarter with <span className="text-primary">Transio</span>
          </h1>
          <p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground">
            Find and book bus trips across the country. Real-time tracking, easy booking, and
            reliable service.
          </p>

          <SearchForm mode="compact" className="mx-auto max-w-3xl" />
        </div>
      </section>

      {/* Features Section */}
      <section className="px-4 py-16" aria-labelledby="features-heading">
        <h2 id="features-heading" className="sr-only">
          Features
        </h2>
        <div className="mx-auto grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <FeatureCard
            icon={<Clock className="h-8 w-8 text-primary" />}
            title="Real-time tracking"
            description="Track your bus live on the map. Know exactly when it arrives."
          />
          <FeatureCard
            icon={<Shield className="h-8 w-8 text-primary" />}
            title="Secure booking"
            description="Book with confidence. Instant confirmation and easy cancellation."
          />
          <FeatureCard
            icon={<Bus className="h-8 w-8 text-primary" />}
            title="Wide coverage"
            description="Hundreds of routes connecting cities and towns across the country."
          />
        </div>
      </section>
    </div>
  );
}

/** Props for the {@link FeatureCard} component. */
interface FeatureCardProps {
  /** Icon element displayed at the top of the card. */
  icon: React.ReactNode;
  /** Feature title. */
  title: string;
  /** Feature description text. */
  description: string;
}

/**
 * Feature highlight card with icon, title, and description.
 * Used on the home page to showcase platform features.
 */
function FeatureCard({ icon, title, description }: FeatureCardProps) {
  return (
    <div className="glass-card p-6 text-center">
      <div className="mb-4 flex justify-center">{icon}</div>
      <h3 className="mb-2 text-lg font-semibold text-white">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
