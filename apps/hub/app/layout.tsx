import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "KNUD Design QA Hub",
  description: "Reproducible visual QA for KNUD deployments",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
