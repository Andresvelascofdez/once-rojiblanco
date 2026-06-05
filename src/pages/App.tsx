import { Dice5, Eye, EyeOff, Lock, Play, RotateCcw, Share2, ShieldCheck, Shuffle, Trophy } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { availablePlayersForSeason, completedPicks, compatibleSlots, createEmptyPicks, makePick, rollSeason } from "../engine/draft";
import { defaultFormation, formations } from "../engine/formations";
import { canPlay } from "../engine/positions";
import { calculateStrength, simulateSeason } from "../engine/simulator";
import type {
  GameData,
  Pick,
  PoolMode,
  SimulationResult,
  SportingPlayer,
  VisibilityMode,
} from "../engine/types";

type Screen = "home" | "game" | "privacy";

const sportingTeamName = "Sporting de Gijón";
const balancedSeasonText = "1980-2026";

const maxRerolls = (poolMode: PoolMode, visibility: VisibilityMode) => {
  if (poolMode === "easy" && visibility === "visible") return 4;
  if (poolMode === "easy") return 3;
  if (visibility === "visible") return 2;
  return 1;
};

const outcomeText: Record<SimulationResult["outcome"], string> = {
  "direct-promotion": "Ascenso directo",
  "playoff-promotion": "Ascenso por playoff",
  "playoff-elimination": "Caímos en el playoff",
  "no-promotion": "No hubo ascenso",
};

function modeLabel(poolMode: PoolMode) {
  return poolMode === "easy" ? "Fácil · Primera y Segunda" : "Difícil · solo Segunda";
}

function visibilityLabel(visibility: VisibilityMode) {
  return visibility === "visible" ? "Medias visibles" : "Sin medias";
}

function positionText(player: SportingPlayer) {
  return player.secondaryPositions?.length
    ? `${player.positionCode} / ${player.secondaryPositions.join(", ")}`
    : player.positionCode;
}

function appShareUrl() {
  const configured = (import.meta as ImportMeta & { env?: { VITE_PUBLIC_APP_URL?: string } }).env?.VITE_PUBLIC_APP_URL?.trim();
  if (configured) return configured;
  return typeof window === "undefined" ? "https://once-rojiblanco.example.com" : window.location.origin;
}

function positionOrdinal(position: number) {
  return `${position}.º`;
}

function resultShareText(result: SimulationResult, rowPoints: number, goalsFor: number, goalsAgainst: number) {
  const headline = result.outcome === "direct-promotion" || result.outcome === "playoff-promotion"
    ? "¡Subí al Sporting con mi Once Rojiblanco!"
    : "Mi Once Rojiblanco peleó la Segunda 2025-26.";
  return `${headline} Terminé ${positionOrdinal(result.sportingPosition)} con ${rowPoints} puntos (${goalsFor}-${goalsAgainst}) y media ${result.strength.overall}: ATA ${result.strength.attack}, DEF ${result.strength.defense}. Prueba tu XI histórico.`;
}

export function App() {
  const [data, setData] = useState<GameData | null>(null);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>("home");
  const [poolMode, setPoolMode] = useState<PoolMode>("easy");
  const [visibility, setVisibility] = useState<VisibilityMode>("visible");
  const [formation, setFormation] = useState(defaultFormation);
  const [picks, setPicks] = useState<Array<Pick | null>>(() => createEmptyPicks(defaultFormation));
  const [rolledSeason, setRolledSeason] = useState<string | null>(null);
  const [rollCount, setRollCount] = useState(0);
  const [rerollsLeft, setRerollsLeft] = useState(maxRerolls("easy", "visible"));
  const [selectedPlayer, setSelectedPlayer] = useState<SportingPlayer | null>(null);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [gameSeed, setGameSeed] = useState(() => Math.random().toString(36).slice(2));

  useEffect(() => {
    fetch("/data/game-data.json")
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<GameData>;
      })
      .then(setData)
      .catch((error) => setLoadingError(String(error)));
  }, []);

  const slots = formations[formation];
  const completePicks = completedPicks(picks);
  const isComplete = completePicks.length === slots.length;
  const draftStrength = isComplete ? calculateStrength(completePicks) : null;
  const visibleRating = visibility === "visible";
  const availablePlayers = useMemo(() => {
    if (!data || !rolledSeason) return [];
    return availablePlayersForSeason(
      data.sportingPlayers,
      rolledSeason,
      poolMode,
      picks,
      formation,
      `${gameSeed}:${rolledSeason}:${rollCount}`,
    );
  }, [data, formation, gameSeed, picks, poolMode, rollCount, rolledSeason]);

  const compatibleTargetIndexes = useMemo(() => {
    if (!selectedPlayer) return [];
    return compatibleSlots(selectedPlayer, picks, formation);
  }, [formation, picks, selectedPlayer]);

  function resetDraft(nextFormation = formation, nextPool = poolMode, nextVisibility = visibility) {
    setFormation(nextFormation);
    setPicks(createEmptyPicks(nextFormation));
    setRolledSeason(null);
    setSelectedPlayer(null);
    setResult(null);
    setRerollsLeft(maxRerolls(nextPool, nextVisibility));
    setGameSeed(Math.random().toString(36).slice(2));
  }

  function doRoll(isReroll = false) {
    if (!data) return;
    if (isReroll && rerollsLeft <= 0) return;
    const seed = `${gameSeed}:${rollCount}:${Date.now()}:${Math.random()}`;
    const season = rollSeason(data.sportingPlayers, poolMode, picks, formation, seed);
    setRolledSeason(season);
    setSelectedPlayer(null);
    setRollCount((value) => value + 1);
    if (isReroll) setRerollsLeft((value) => Math.max(0, value - 1));
  }

  function assignPlayer(index: number) {
    if (!selectedPlayer || !slots[index] || picks[index]) return;
    if (!canPlay(selectedPlayer, slots[index])) return;
    const next = [...picks];
    next[index] = makePick(selectedPlayer, slots[index]);
    setPicks(next);
    setSelectedPlayer(null);
    setRolledSeason(null);
    setResult(null);
  }

  function removePick(index: number) {
    const next = [...picks];
    next[index] = null;
    setPicks(next);
    setResult(null);
  }

  function simulate() {
    if (!data || !isComplete) return;
    setResult(simulateSeason(completePicks, data.opponents, data.fixtures, gameSeed));
  }

  function chooseModeFromHome(mode: PoolMode) {
    setPoolMode(mode);
    resetDraft(formation, mode, visibility);
    setScreen("game");
  }

  if (loadingError) {
    return <main className="shell"><p>No se pudieron cargar los datos: {loadingError}</p></main>;
  }
  if (!data) {
    return <main className="shell"><p>Cargando datos rojiblancos...</p></main>;
  }

  const seasonCount = new Set(data.sportingPlayers.map((player) => player.season)).size;
  const playerCount = new Set(data.sportingPlayers.map((player) => player.playerId)).size;

  const nav = (
    <nav className="site-nav" aria-label="Secciones">
      {([
        ["home", "Inicio"],
        ["game", "Juego"],
        ["privacy", "Privacidad"],
      ] as Array<[Screen, string]>).map(([target, label]) => (
        <button key={target} className={screen === target ? "active" : ""} onClick={() => setScreen(target)}>
          {label}
        </button>
      ))}
    </nav>
  );

  if (screen === "privacy") {
    return (
      <main className="shell">
        <header className="site-header">
          <button className="brand-lockup" onClick={() => setScreen("home")}>
            <span>11</span>
            <strong>Once Rojiblanco</strong>
          </button>
          {nav}
        </header>

        <section className="privacy-page">
          <p className="eyebrow">Privacidad</p>
          <h1>Juego local, datos mínimos</h1>
          <div className="privacy-grid">
            <article>
              <Lock size={22} />
              <h2>Sin cuentas</h2>
              <p>No hay registro, login ni perfiles de usuario. El once que montas vive en el estado del navegador mientras juegas.</p>
            </article>
            <article>
              <ShieldCheck size={22} />
              <h2>Datos del juego</h2>
              <p>La app carga un JSON estático con plantillas históricas, rivales y calendario. No incluye datos personales de jugadores actuales fuera de información futbolística pública.</p>
            </article>
            <article>
              <Share2 size={22} />
              <h2>Compartir</h2>
              <p>El botón de compartir abre Twitter/X con un texto y la URL de la web. A partir de ahí, aplican las condiciones de ese servicio externo.</p>
            </article>
          </div>
        </section>
      </main>
    );
  }

  if (screen === "home") {
    return (
      <main className="shell">
        <header className="site-header">
          <button className="brand-lockup" onClick={() => setScreen("home")}>
            <span>11</span>
            <strong>Once Rojiblanco</strong>
          </button>
          {nav}
        </header>

        <section className="home-hero">
          <div className="hero-copy">
            <p className="eyebrow">Sporting histórico · Segunda 2025-26</p>
            <h1>Tira el dado. Arma tu once. Mira si subimos.</h1>
            <p>
              Sortea temporadas del Sporting desde {balancedSeasonText}, elige jugadores históricos compatibles con tu sistema y simula la liga completa de Segunda.
            </p>
            <div className="hero-actions">
              <button className="icon-text primary" onClick={() => setScreen("game")}>
                <Play size={18} /> Jugar ahora
              </button>
              <button className="icon-text" onClick={() => chooseModeFromHome("hard")}>
                <Dice5 size={18} /> Probar modo difícil
              </button>
            </div>
          </div>

          <div className="lineup-preview" aria-label="Muestra de once 4-3-3">
            <div className="preview-score">
              <span>OVR</span>
              <strong>76</strong>
            </div>
            {[
              ["POR", 50, 86],
              ["LD", 82, 68],
              ["DFC", 61, 72],
              ["DFC", 39, 72],
              ["LI", 18, 68],
              ["MC", 66, 50],
              ["MCD", 50, 56],
              ["MC", 34, 50],
              ["ED", 78, 28],
              ["DC", 50, 20],
              ["EI", 22, 28],
            ].map(([position, x, y]) => (
              <span
                key={`${position}-${x}-${y}`}
                className="preview-chip"
                style={{ left: `${x}%`, top: `${y}%` }}
              >
                {position}
              </span>
            ))}
          </div>
        </section>

        <section className="mode-showcase">
          <button className="mode-card" onClick={() => chooseModeFromHome("easy")}>
            <span className="label">Modo fácil</span>
            <strong>Primera + Segunda</strong>
            <small>Equilibrado a partir de {balancedSeasonText}, para que los años setenta no rompan la dificultad.</small>
          </button>
          <button className="mode-card" onClick={() => chooseModeFromHome("hard")}>
            <span className="label">Modo difícil</span>
            <strong>Solo Segunda</strong>
            <small>Menos estrellas, más oficio y más dependencia del sorteo.</small>
          </button>
          <div className="mode-card static">
            <span className="label">Formaciones</span>
            <strong>{Object.keys(formations).length} sistemas</strong>
            <small>Del 4-3-3 al 5-3-2, con penalizaciones por posición secundaria.</small>
          </div>
        </section>

        <section className="steps-band">
          <div><b>01</b><strong>Tira</strong><span>Sale una temporada rojiblanca.</span></div>
          <div><b>02</b><strong>Elige</strong><span>Coloca un jugador compatible.</span></div>
          <div><b>03</b><strong>Simula</strong><span>Se juega la Segunda 2025-26.</span></div>
        </section>

        <footer className="home-footer">
          <span>{seasonCount} temporadas · {playerCount} jugadores · {data.fixtures.length} partidos</span>
          <button onClick={() => setScreen("privacy")}>Privacidad</button>
        </footer>
      </main>
    );
  }

  if (result) {
    const simulationResult = result;
    const sportingRow = simulationResult.table.find((row) => row.team === sportingTeamName);
    const sportingFixtureResults = simulationResult.fixtures.filter(
      (fixture) => fixture.homeTeam === sportingTeamName || fixture.awayTeam === sportingTeamName,
    );

    function shareResult() {
      const text = resultShareText(
        simulationResult,
        sportingRow?.points ?? 0,
        sportingRow?.goalsFor ?? 0,
        sportingRow?.goalsAgainst ?? 0,
      );
      const shareUrl = appShareUrl();
      window.open(
        `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`,
        "_blank",
        "noopener,noreferrer",
      );
    }

    return (
      <main className="shell">
        <header className="site-header">
          <button className="brand-lockup" onClick={() => setScreen("home")}>
            <span>11</span>
            <strong>Once Rojiblanco</strong>
          </button>
          {nav}
        </header>

        <section className="result-topline">
          <div>
            <p className="eyebrow">Resultado</p>
            <h1>{outcomeText[simulationResult.outcome]}</h1>
          </div>
          <div className="result-actions">
            <button className="icon-text" onClick={shareResult}>
              <Share2 size={18} /> Compartir
            </button>
            <button className="icon-text ghost" onClick={() => resetDraft()}>
              <RotateCcw size={18} /> Nuevo intento
            </button>
          </div>
        </section>

        <section className="results results-page">
          <div className="result-hero">
            <Trophy size={26} />
            <div>
              <p className="eyebrow">Temporada simulada</p>
              <h2>
                Puesto {simulationResult.sportingPosition}. {sportingRow?.points ?? 0} puntos
              </h2>
              <p>{sportingRow?.goalsFor ?? 0}-{sportingRow?.goalsAgainst ?? 0} en goles</p>
            </div>
          </div>

          <div className="team-box strength-strip">
            <div><span className="label">OVR</span><strong>{simulationResult.strength.overall}</strong></div>
            <div><span className="label">ATA</span><strong>{simulationResult.strength.attack}</strong></div>
            <div><span className="label">DEF</span><strong>{simulationResult.strength.defense}</strong></div>
            <div><span className="label">Modo</span><strong>{modeLabel(poolMode)}</strong></div>
            <div><span className="label">Medias</span><strong>{visibilityLabel(visibility)}</strong></div>
          </div>
          <p className="model-disclaimer">
            Medias estimadas con división, clasificación final, minutos, titularidad, goles y posición. Es un modelo lúdico y puede contener errores históricos.
          </p>

          <div className="result-grid">
            <div className="table-wrap">
              <h3>Clasificación</h3>
              <table>
                <thead>
                  <tr><th>#</th><th>Equipo</th><th>Pts</th><th>DG</th><th>GF</th><th>GC</th></tr>
                </thead>
                <tbody>
                  {simulationResult.table.map((row, index) => (
                    <tr key={row.team} className={row.team === sportingTeamName ? "me" : ""}>
                      <td>{index + 1}</td>
                      <td>{row.team}</td>
                      <td>{row.points}</td>
                      <td>{row.goalDifference}</td>
                      <td>{row.goalsFor}</td>
                      <td>{row.goalsAgainst}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="fixture-wrap">
              <h3>Partidos del Sporting</h3>
              <div className="fixture-list">
                {sportingFixtureResults.map((fixture, index) => (
                  <div key={`${fixture.matchday}-${index}`} className="fixture-row">
                    <span>J{fixture.matchday}</span>
                    <strong>{fixture.homeTeam} {fixture.homeGoals}-{fixture.awayGoals} {fixture.awayTeam}</strong>
                  </div>
                ))}
              </div>
              {simulationResult.playoff && (
                <div className="playoff-box">
                  <h3>Playoff</h3>
                  {[simulationResult.playoff.semifinalA, simulationResult.playoff.semifinalB, simulationResult.playoff.final].filter(Boolean).map((tie) => (
                    <p key={`${tie!.homeFirst}-${tie!.awayFirst}`}>
                      {tie!.homeFirst} vs {tie!.awayFirst}: global {tie!.aggregate}, pasa {tie!.winner}
                      {tie!.reason === "league_position" ? " por mejor clasificación" : ""}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <header className="site-header">
        <button className="brand-lockup" onClick={() => setScreen("home")}>
          <span>11</span>
          <strong>Once Rojiblanco</strong>
        </button>
        {nav}
      </header>

      <section className="game-title">
        <div>
          <p className="eyebrow">Simulador histórico · Segunda 2025-26</p>
          <h1>Elige tu once</h1>
        </div>
        <button className="icon-text ghost" onClick={() => resetDraft()}>
          <RotateCcw size={18} /> Reiniciar
        </button>
      </section>

      <section className="controls-band">
        <div className="control-group">
          <span className="label">Modo</span>
          <div className="segmented">
            {(["easy", "hard"] as PoolMode[]).map((mode) => (
              <button
                key={mode}
                className={poolMode === mode ? "active" : ""}
                onClick={() => {
                  setPoolMode(mode);
                  resetDraft(formation, mode, visibility);
                }}
              >
                {modeLabel(mode)}
              </button>
            ))}
          </div>
        </div>
        <div className="control-group">
          <span className="label">Información</span>
          <div className="segmented compact">
            {(["visible", "hidden"] as VisibilityMode[]).map((mode) => (
              <button
                key={mode}
                className={visibility === mode ? "active" : ""}
                onClick={() => {
                  setVisibility(mode);
                  resetDraft(formation, poolMode, mode);
                }}
              >
                {mode === "visible" ? <Eye size={16} /> : <EyeOff size={16} />}
                {visibilityLabel(mode)}
              </button>
            ))}
          </div>
        </div>
        <div className="control-group formation-control">
          <span className="label">Formación</span>
          <select
            value={formation}
            onChange={(event) => resetDraft(event.target.value, poolMode, visibility)}
          >
            {Object.keys(formations).map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>
      </section>
      <p className="model-disclaimer">
        Modo fácil limitado a temporadas {balancedSeasonText}. Medias estimadas con división, clasificación final, minutos, titularidad, goles y posición.
      </p>

      <section className="layout">
        <div className="left-panel">
          <div className="roll-panel">
            <div>
              <p className="eyebrow">Sorteo</p>
              <h2>{rolledSeason ? `Temporada ${rolledSeason}` : "Tira para buscar plantilla"}</h2>
            </div>
            <div className="roll-actions">
              <button className="icon-text primary" disabled={isComplete} onClick={() => doRoll(false)}>
                <Dice5 size={18} /> Tirar
              </button>
              <button className="icon-text" disabled={isComplete || !rolledSeason || rerollsLeft <= 0} onClick={() => doRoll(true)}>
                <Shuffle size={18} /> Reroll {rerollsLeft}
              </button>
            </div>
          </div>

          {rolledSeason && (
            <div className="player-list">
              {availablePlayers.length === 0 ? (
                <p className="muted">No queda nadie compatible en esta plantilla. Tira otra vez.</p>
              ) : (
                availablePlayers.slice(0, 28).map((player) => (
                  <button
                    key={`${player.season}:${player.playerId}:${player.positionCode}`}
                    className={`player-row ${selectedPlayer?.playerId === player.playerId ? "selected" : ""}`}
                    onClick={() => setSelectedPlayer(player)}
                  >
                    <span>
                      <strong>{player.shortName}</strong>
                      <small>
                        {visibleRating
                          ? `${positionText(player)} · ${player.apps} PJ · ${player.goals} G`
                          : positionText(player)}
                      </small>
                    </span>
                    <b className="rating">{visibleRating ? player.rating : "?"}</b>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <div className="pitch-panel">
          <div className="pitch">
            <div className="midline" />
            <div className="circle" />
            {slots.map((slot, index) => {
              const pick = picks[index];
              const target = compatibleTargetIndexes.includes(index);
              return (
                <button
                  key={slot.id}
                  className={`disc ${pick ? "filled" : ""} ${target ? "target" : ""}`}
                  style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
                  onClick={() => (pick ? removePick(index) : assignPlayer(index))}
                  title={pick ? "Quitar jugador" : "Asignar jugador"}
                >
                  <span className="disc-pos">{slot.position}</span>
                  {pick && (
                    <>
                      <span className="disc-name">{pick.player.shortName}</span>
                      <span className="disc-rating">{visibleRating ? pick.adjustedRating : "?"}</span>
                    </>
                  )}
                </button>
              );
            })}
          </div>
          <div className="team-box">
            <div><span className="label">Alineación</span><strong>{completePicks.length}/11</strong></div>
            <div><span className="label">Modo</span><strong>{modeLabel(poolMode)}</strong></div>
            <div><span className="label">Medias</span><strong>{visibilityLabel(visibility)}</strong></div>
            {draftStrength && visibleRating && (
              <>
                <div><span className="label">OVR</span><strong>{draftStrength.overall}</strong></div>
                <div><span className="label">ATA</span><strong>{draftStrength.attack}</strong></div>
                <div><span className="label">DEF</span><strong>{draftStrength.defense}</strong></div>
              </>
            )}
          </div>
          <button className="simulate icon-text primary" disabled={!isComplete} onClick={simulate}>
            <Play size={18} /> Simular Segunda 2025-26
          </button>
        </div>
      </section>
    </main>
  );
}
