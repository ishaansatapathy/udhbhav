import { WalletSection } from "../components/WalletSection"
import TacticalLayout from "../components/TacticalLayout"
import TacticalNav from "../components/TacticalNav"

export default function WalletPage() {
  return (
    <TacticalLayout>
      <TacticalNav />
      <div className="pt-20">
        <WalletSection />
      </div>
    </TacticalLayout>
  )
}
