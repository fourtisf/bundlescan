import Nav from "@/components/Nav";
import ScanExperience from "@/components/ScanExperience";
import LiveFeed from "@/components/LiveFeed";
import HallOfShame from "@/components/HallOfShame";
import Access from "@/components/Access";
import { Capabilities, Tiers, Method, ShareCardSection, Footer } from "@/components/Sections";

export default function Home() {
  return (
    <>
      <Nav />
      <ScanExperience />
      <LiveFeed />
      <Capabilities />
      <Tiers />
      <Method />
      <HallOfShame />
      <ShareCardSection />
      <Access />
      <Footer />
    </>
  );
}
