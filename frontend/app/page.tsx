import { MarketTable } from "@/components/MarketTable";
import { HeroSection } from "@/components/sections/HeroSection";
import { EarnSection, FeaturedGrid, NewsFaqSection, PromoRail, SecuritySection, WhyChooseUsSection } from "@/components/sections/OverviewSections";
import { ContentSection } from "@/components/PageShell";
import { SectionTitle } from "@/components/ui/SectionTitle";

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <FeaturedGrid />
      <WhyChooseUsSection />
      <ContentSection>
        <SectionTitle eyebrow="Markets" title="Top gainers, movers, and exchange-ready market discovery" />
        <MarketTable />
      </ContentSection>
      <SecuritySection />
      <PromoRail />
      <EarnSection />
      <NewsFaqSection />
    </>
  );
}

