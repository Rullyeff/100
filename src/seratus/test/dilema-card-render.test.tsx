import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import game from "./crash-game.json";
import { GameScreen } from "@/seratus/components/game/GameScreen";
import { redactGame } from "@/seratus/game/room-rules";
import { upgradeBoard } from "@/seratus/game/board-upgrade";

it("renders a weighted dilema card from public (key-less) card data without crashing", async () => {
  (globalThis as any).ResizeObserver ??= class { observe(){} unobserve(){} disconnect(){} };
  const s = redactGame(upgradeBoard(game as any) as any);
  render(<GameScreen state={s} dispatch={() => {}} error={null} speed={700} setSpeed={() => {}} paused={false} setPaused={() => {}} onQuit={() => {}} testDice={false} localActor={4} />);
  // Kartu dibuka dari gambar kartu di papan; kartu baru tampil setelah dadu selesai mendarat
  const spots = document.querySelectorAll(".board-card-spot");
  expect(spots.length).toBeGreaterThan(0);
  fireEvent.click(spots[0]);
  const found = await screen.findAllByText(/calon ketua OSIS/, undefined, { timeout: 5000 });
  expect(found.length).toBeGreaterThan(0);
});
