import type { Metadata } from "next";
import { generateTermsMetadata } from "./metadata";

export const metadata: Metadata = generateTermsMetadata();

export default function TermsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
