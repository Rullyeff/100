import { EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AREAS, type Player } from "@/seratus/game/view";
import { cn } from "@/lib/utils";
import { AREA_BG } from "./theme";

export function HandoffOverlay({ player, secret, onReady }: { player: Player; secret: boolean; onReady: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 p-6 backdrop-blur" role="dialog" aria-modal="true">
      <div className="max-w-sm text-center text-foreground">
        <div className={cn("mx-auto flex size-20 items-center justify-center rounded-full text-3xl font-extrabold", AREA_BG[player.area])}>
          {player.name.charAt(0).toUpperCase()}
        </div>
        <h2 className="mt-4 font-display text-2xl font-extrabold">Serahkan perangkat ke {player.name}</h2>
        <p className="mt-2 text-sm opacity-80">
          {AREAS[player.area].name}.{" "}
          {secret ? "Pilihan ini rahasia — pemain lain jangan melihat layar." : "Giliranmu berikutnya."}
        </p>
        {secret && <EyeOff className="mx-auto mt-3 size-6 text-gold" />}
        <Button autoFocus variant="gold" size="lg" className="mt-6 w-full" onClick={onReady}>
          Saya {player.name}, lanjutkan
        </Button>
      </div>
    </div>
  );
}
