import { Cube } from "./Dice3D";

/** The landing surface stays separate from the playable board spaces. */
export function DiceTray({ value }: { value: number | null }) {
  return (
    <div className="dice-tray-dock">
      <div className="dice-tray" role="img" aria-label={value ? `Wadah dadu · hasil ${value}` : "Wadah dadu"}>
        <div className="dice-tray-floor">
          <span className="dice-tray-mark" aria-hidden="true">100 SUARA</span>
          <div className="dice-tray-resting" aria-hidden="true">
            {value !== null && <><span className="dice-contact-shadow" /><Cube value={value} size={44} /></>}
          </div>
        </div>
        <span className="dice-tray-rim" aria-hidden="true" />
      </div>
    </div>
  );
}