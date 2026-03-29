import { HelpCircle, Mail } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { usePageTitle } from '@/hooks/use-page-title';

/** FAQ item shape from the help translation namespace. */
interface FaqItem {
  q: string;
  a: string;
}

/** FAQ category shape from the help translation namespace. */
interface FaqCategory {
  title: string;
  items: FaqItem[];
}

const CATEGORY_KEYS = ['booking', 'travel', 'account'] as const;

/**
 * Help & FAQ page. Displays frequently asked questions grouped by category
 * with expandable accordion sections and a contact card.
 */
export default function HelpPage() {
  const { t } = useTranslation('help');
  usePageTitle(t('pageTitle'));

  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative flex items-center justify-center px-4 py-20">
        <div className="mx-auto w-full max-w-3xl text-center">
          <div className="mb-4 flex justify-center">
            <HelpCircle className="h-12 w-12 text-accent" />
          </div>
          <h1 className="mb-4 text-4xl font-bold tracking-tight text-white sm:text-5xl">
            {t('heading')}
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">{t('description')}</p>
        </div>
      </section>

      {/* FAQ Categories */}
      <section className="mx-auto w-full max-w-3xl space-y-8 px-4 pb-16">
        {CATEGORY_KEYS.map((key) => {
          const category = t(`categories.${key}`, { returnObjects: true }) as FaqCategory;
          return <FaqSection key={key} category={category} categoryKey={key} />;
        })}

        {/* Contact Section */}
        <div className="glass-card p-8 text-center">
          <Mail className="mx-auto mb-4 h-8 w-8 text-accent" />
          <h2 className="mb-2 text-xl font-semibold text-white">{t('contact.title')}</h2>
          <p className="mb-4 text-muted-foreground">{t('contact.description')}</p>
          <a
            href={`mailto:${t('contact.email')}`}
            className="font-medium text-accent hover:underline"
          >
            {t('contact.email')}
          </a>
        </div>
      </section>
    </div>
  );
}

/** Props for {@link FaqSection}. */
interface FaqSectionProps {
  /** The FAQ category data containing title and items. */
  category: FaqCategory;
  /** Unique key for the category, used to generate accordion item values. */
  categoryKey: string;
}

/**
 * A single FAQ category section with a heading and an accordion of questions.
 */
function FaqSection({ category, categoryKey }: FaqSectionProps) {
  return (
    <div className="glass-card p-6">
      <h2 className="mb-4 text-xl font-semibold text-white">{category.title}</h2>
      <Accordion type="single" collapsible>
        {category.items.map((item, index) => (
          <AccordionItem key={index} value={`${categoryKey}-${index}`}>
            <AccordionTrigger className="text-left text-white">{item.q}</AccordionTrigger>
            <AccordionContent className="text-muted-foreground">{item.a}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
