import type { Metadata } from "next";
import FullTerminal from "@/components/FullTerminal";

export const metadata: Metadata = {
  title: "Live Terminal — BundleScan",
  description: "Every new Solana launch, X-rayed and scored in realtime.",
};

export default function TerminalPage() {
  return <FullTerminal />;
}
