
'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Mail, Github, Users, BookOpen, Search, Book, Heart, Bot, MessageSquare, Sparkles } from 'lucide-react';
import { useTranslation } from '@/i18n/provider';
import { useEdition } from '@/contexts/EditionContext';

const linkDefs = [
  {
    titleKey: 'about.links.jcr',
    href: 'https://clarivate.com/academia-government/scientific-and-academic-research/research-funding-analytics/journal-citation-reports/',
  },
  {
    titleKey: 'about.links.cas',
    href: 'https://www.fenqubiao.com/',
  },
  {
    titleKey: 'about.links.xr',
    href: 'https://www.xr-scholar.com/',
  },
  {
    titleKey: 'about.links.xynu',
    href: 'http://kjc.xynu.edu.cn/info/1004/1251.htm',
  },
  {
    titleKey: 'about.links.letpub',
    href: 'https://www.letpub.com.cn/index.php?page=journalapp',
  },
  {
    titleKey: 'about.links.showjcr',
    href: 'https://github.com/hitfyd/ShowJCR',
  },
  {
    titleKey: 'about.links.authorityClassification',
    href: 'https://github.com/yuzhounh/Authoritative-Journal-Classification',
  },
] as const;

const FeatureCard = ({ icon: Icon, title, description }: { icon: React.ElementType, title: string, description: string }) => (
    <Card>
        <CardHeader className="flex flex-row items-center gap-4 pb-4">
            <div className="bg-primary/10 p-3 rounded-lg">
                <Icon className="w-6 h-6 text-primary" />
            </div>
            <CardTitle className="text-xl font-headline">{title}</CardTitle>
        </CardHeader>
        <CardContent>
            <p className="text-foreground/80">{description}</p>
        </CardContent>
    </Card>
);

export default function AboutPage() {
  const { t, locale } = useTranslation();
  const { editions, currentEditionId, setEditionId } = useEdition();

  const editionsNewestFirst = useMemo(
    () =>
      [...editions].sort((a, b) => {
        if (b.partitionYear !== a.partitionYear) {
          return b.partitionYear - a.partitionYear;
        }
        return b.impactFactorYear - a.impactFactorYear;
      }),
    [editions]
  );

  const contacts = [
      {
          icon: Users,
          label: t('about.contact.author'),
          value: t('about.contact.authorName'),
      },
      {
          icon: Mail,
          label: t('about.contact.email'),
          value: 'yuzhounh@163.com',
          href: 'mailto:yuzhounh@163.com'
      },
      {
          icon: Github,
          label: t('about.contact.github'),
          value: 'yuzhounh/aji-editions',
          href: 'https://github.com/yuzhounh/aji-editions'
      }
  ]
  
  const features = [
    {
        icon: Search,
        titleKey: 'about.features.search.title',
        descriptionKey: 'about.features.search.p1',
    },
    {
        icon: Book,
        titleKey: 'about.features.browse.title',
        descriptionKey: 'about.features.browse.p1',
    },
    {
        icon: Heart,
        titleKey: 'about.features.favorites.title',
        descriptionKey: 'about.features.favorites.p1',
    },
    {
        icon: Bot,
        titleKey: 'about.features.ai.title',
        descriptionKey: 'about.features.ai.p1',
    },
];

  return (
    <div className="w-full space-y-8 animate-in fade-in-50 duration-300">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-headline text-2xl">
            <BookOpen className="text-primary" />
            {t('about.title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-base text-foreground/80 leading-relaxed space-y-4">
          <p>{t('about.p1')}</p>
          <p>{t('about.p2')}</p>
          <div className="rounded-lg border border-border/60 bg-muted/30 p-4 space-y-4">
            <p className="font-medium text-foreground">{t('about.dataSourceTitle')}</p>
            <p>{t('about.dataSourceIntro')}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {editionsNewestFirst.map((edition) => {
                const partitionLabel =
                  edition.partitionType === 'xr' ? t('about.dataXr') : t('about.dataCas');
                const isActive = edition.id === currentEditionId;

                return (
                  <button
                    key={edition.id}
                    type="button"
                    onClick={() => setEditionId(edition.id)}
                    className={`w-full rounded-lg border p-4 text-left transition-colors ${
                      isActive
                        ? 'border-primary/50 bg-primary/5'
                        : 'border-border/60 bg-background hover:border-primary/30'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium">
                        {locale === 'zh' ? edition.label.zh : edition.label.en}
                      </span>
                      {isActive && <Badge variant="secondary">{t('edition.currentLabel')}</Badge>}
                    </div>
                    <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                      <div className="flex items-baseline justify-between gap-3">
                        <span>
                          {t('about.dataJcr')} {edition.impactFactorYear}
                        </span>
                        <span className="shrink-0 text-right font-mono">
                          — {t('about.editionRelease', { date: edition.impactFactorReleaseDate })}
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between gap-3">
                        <span>
                          {partitionLabel} {edition.partitionYear}
                        </span>
                        <span className="shrink-0 text-right font-mono">
                          — {t('about.editionRelease', { date: edition.partitionReleaseDate })}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          <p>{t('about.p3')}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
            <CardTitle className="flex items-center gap-3 font-headline text-2xl">
                <Sparkles className="text-primary" />
                {t('about.features.title')}
            </CardTitle>
        </CardHeader>
        <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {features.map(feature => (
                    <FeatureCard 
                        key={feature.titleKey}
                        icon={feature.icon}
                        title={t(feature.titleKey)}
                        description={t(feature.descriptionKey)}
                    />
                ))}
            </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-headline text-2xl">
            <ExternalLink className="text-primary" />
            {t('about.linksTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {linkDefs.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                <Card className="h-full hover:shadow-md hover:border-primary/50 transition-all">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="bg-primary/10 p-2 rounded-md">
                        <ExternalLink className="w-5 h-5 text-primary" />
                    </div>
                    <span className="font-medium text-sm flex-1">{t(link.titleKey)}</span>
                  </CardContent>
                </Card>
              </a>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-headline text-2xl">
            <MessageSquare className="text-primary" />
            {t('about.feedback.title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
            <p className="text-base text-foreground/80">{t('about.feedback.p1')}</p>
            <Button asChild variant="ghost" className="gap-2 bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary">
                <a href="https://github.com/yuzhounh/aji-editions/issues" target="_blank" rel="noopener noreferrer">
                    <Github className="w-5 h-5" />
                    {t('about.feedback.button')}
                </a>
            </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-headline text-2xl">
            <Users className="text-primary" />
            {t('about.contactTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
            {contacts.map(contact => (
                <div key={contact.label} className="flex items-center gap-4">
                    <div className="flex items-center gap-2 w-24">
                        <contact.icon className="w-5 h-5 text-muted-foreground"/>
                        <span className="font-semibold">{contact.label}</span>
                    </div>
                    {contact.href ? (
                        <a href={contact.href} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-mono">
                            {contact.value}
                        </a>
                    ) : (
                        <span className="font-medium">{contact.value}</span>
                    )}
                </div>
            ))}
        </CardContent>
      </Card>
    </div>
  );
}
