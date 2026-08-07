import { QaWorkspace } from "@/components/qa-workspace";
import { AuthGate } from "@/components/auth-gate";

export default function Home() {
  return <AuthGate><QaWorkspace deploymentUrl={process.env.NEXT_PUBLIC_KNUD_DEPLOYMENT_URL ?? null} /></AuthGate>;
}
