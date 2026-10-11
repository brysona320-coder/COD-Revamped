export const MATCH_DURATION = 300;
export const SCORE_LIMIT = 25;

export interface Score { kills: number; deaths: number; streak: number; bestStreak: number; shots: number; hits: number; elapsed: number }
export function newScore(): Score { return { kills: 0, deaths: 0, streak: 0, bestStreak: 0, shots: 0, hits: 0, elapsed: 0 }; }
export function registerKill(score: Score): Score {
  const streak = score.streak + 1;
  return { ...score, kills: score.kills + 1, streak, bestStreak: Math.max(streak, score.bestStreak) };
}
export function registerDeath(score: Score): Score { return { ...score, deaths: score.deaths + 1, streak: 0 }; }
export function accuracy(score: Score): number { return score.shots ? Math.round((score.hits / score.shots) * 100) : 0; }
export function matchOver(score: Score): boolean { return score.kills >= SCORE_LIMIT || score.elapsed >= MATCH_DURATION; }
export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
export function scoreXP(score: Score): number { return score.kills * 75 + score.hits * 4 + Math.max(0, 10 - score.deaths) * 10; }
