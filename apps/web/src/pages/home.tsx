import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MapPin, Calendar, Bus, Shield, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/**
 * Home page with hero section, search form, and feature highlights.
 * The search form navigates to /search with origin, destination, and date query params.
 */
export default function HomePage() {
  const navigate = useNavigate();
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [date, setDate] = useState('');

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (origin) params.set('origin', origin);
    if (destination) params.set('destination', destination);
    if (date) params.set('date', date);
    navigate(`/search?${params.toString()}`);
  };

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

          {/* Search Form */}
          <form
            onSubmit={handleSearch}
            className="glass-card mx-auto max-w-3xl p-6"
            role="search"
            aria-label="Search trips"
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="relative">
                <label htmlFor="origin" className="sr-only">
                  Origin
                </label>
                <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="origin"
                  type="text"
                  placeholder="Origin"
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                  className="pl-9"
                  maxLength={200}
                />
              </div>
              <div className="relative">
                <label htmlFor="destination" className="sr-only">
                  Destination
                </label>
                <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="destination"
                  type="text"
                  placeholder="Destination"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  className="pl-9"
                  maxLength={200}
                />
              </div>
              <div className="relative">
                <label htmlFor="travel-date" className="sr-only">
                  Travel date
                </label>
                <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="travel-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button type="submit" className="w-full">
                <Search className="mr-2 h-4 w-4" />
                Search
              </Button>
            </div>
          </form>
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
