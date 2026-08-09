import { AuthGate } from "@/components/auth-gate";
import { QaHistory } from "@/components/qa-history";

export default function QaHistoryPage() {
  return (
    <AuthGate>
      <QaHistory />
    </AuthGate>
  );
}
