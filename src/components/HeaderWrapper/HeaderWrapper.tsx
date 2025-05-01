"use client";

import { usePathname } from "next/navigation";
import Header from "@/components/Header/Header";
import MintStreetHeader from "@/components/MintStreetHeader/MintStreetHeader";

const HeaderWrapper = () => {
  const pathname = usePathname();
  const isMintStreetPage = pathname?.startsWith('/mintstreet');

  return isMintStreetPage ? <div className="header">
    <MintStreetHeader />
  </div> : <Header />;
};

export default HeaderWrapper;