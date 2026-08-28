import { SiteFooter, SiteHeader } from "@/components/chrome";
import { HomeBoard } from "@/components/home-board";

export default function Page() {
  return (
    <>
      <SiteHeader />
      <HomeBoard />
      <SiteFooter />
    </>
  );
}
