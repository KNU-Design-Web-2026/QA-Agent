import { QaWorkspace } from "@/components/qa-workspace";

export default function Home() {
  return <QaWorkspace deploymentUrl={process.env.NEXT_PUBLIC_KNUD_DEPLOYMENT_URL ?? null} />;
}
