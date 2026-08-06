import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Gamepad2, Clock, ShieldAlert, Ban, Trash2, CheckCircle2, AlertTriangle, RefreshCw, Lock, Megaphone, Trophy, RotateCcw, Sparkles, Zap } from "lucide-react";
import {
  useArcadeConfig,
  updateArcadeConfig,
  useLeaderboard,
  deleteScore,
  resetWeeklyLeaderboard,
  DEFAULT_FORBIDDEN_WORDS,
  type ArcadeMode,
  type RankedRow,
  type ArcadeConfig,
  type ArcadeAnnouncement,
  type ArcadeContest,
} from "@/lib/arcade";
import { cn } from "@/lib/utils";

export function ArcadeControlManager() {
  const { data: config = { mode: "always_on", bannedPlayers: [] }, isLoading: isConfigLoading } = useArcadeConfig();
  const { data: leaderboard = [], refetch } = useLeaderboard();

  const [mode, setMode] = useState<ArcadeMode>(config.mode ?? "always_on");
  const [offlineMessage, setOfflineMessage] = useState(
    config.offlineMessage ?? "The Arcade has been temporarily closed by the administrator. Please check back later!"
  );
  const [timerMinutes, setTimerMinutes] = useState<number>(60);
  const [newWord, setNewWord] = useState("");
  const [busy, setBusy] = useState(false);
  const [remainingSec, setRemainingSec] = useState<number>(0);

  // Announcement state
  const [announcementActive, setAnnouncementActive] = useState(config.announcement?.active ?? false);
  const [announcementTitle, setAnnouncementTitle] = useState(config.announcement?.title ?? "Upcoming Contest!");
  const [announcementMessage, setAnnouncementMessage] = useState(config.announcement?.message ?? "Get ready for the next Signal Rush Tournament version v1.0!");
  const [announcementDateText, setAnnouncementDateText] = useState(config.announcement?.dateText ?? "This Weekend @ 8:00 PM");

  const toLocalISO = (ms: number) => {
    const d = new Date(ms);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  // Contest state
  const [contestActive, setContestActive] = useState(config.contest?.active ?? false);
  const [contestVersion, setContestVersion] = useState(config.contest?.version ?? "v1.0");
  const [contestTitle, setContestTitle] = useState(config.contest?.title ?? "Signal Rush Championship v1.0");
  const [contestDescription, setContestDescription] = useState(config.contest?.description ?? "Compete against top players for the v1.0 Gold Crown!");
  const [contestStartAt, setContestStartAt] = useState<string>(
    toLocalISO(config.contest?.startAt ?? Date.now())
  );
  const [contestEndAt, setContestEndAt] = useState<string>(
    toLocalISO(config.contest?.endAt ?? Date.now() + 7 * 86400 * 1000)
  );

  // Sync state when config loads
  useEffect(() => {
    if (config) {
      setMode(config.mode ?? "always_on");
      setOfflineMessage(
        config.offlineMessage ?? "The Arcade has been temporarily closed by the administrator. Please check back later!"
      );
      if (config.announcement) {
        setAnnouncementActive(config.announcement.active);
        setAnnouncementTitle(config.announcement.title || "Upcoming Contest!");
        setAnnouncementMessage(config.announcement.message || "");
        setAnnouncementDateText(config.announcement.dateText || "");
      }
      if (config.contest) {
        setContestActive(config.contest.active);
        setContestVersion(config.contest.version || "v1.0");
        setContestTitle(config.contest.title || "Signal Rush Championship v1.0");
        setContestDescription(config.contest.description || "");
        setContestStartAt(toLocalISO(config.contest.startAt ?? Date.now()));
        setContestEndAt(toLocalISO(config.contest.endAt ?? Date.now() + 7 * 86400 * 1000));
      }
    }
  }, [config]);

  // Live timer countdown calculation
  useEffect(() => {
    if (config.mode !== "timer" || !config.timerEndAt) {
      setRemainingSec(0);
      return;
    }
    const updateTimer = () => {
      const diff = Math.max(0, Math.floor((config.timerEndAt! - Date.now()) / 1000));
      setRemainingSec(diff);
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [config.mode, config.timerEndAt]);

  const formatCountdown = (totalSec: number) => {
    if (totalSec <= 0) return "Expired";
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
  };

  const saveSettings = async (selectedMode: ArcadeMode, durationMin?: number, customMsg?: string) => {
    setBusy(true);
    try {
      let timerEndAt: number | undefined = undefined;
      if (selectedMode === "timer") {
        const mins = durationMin ?? timerMinutes;
        timerEndAt = Date.now() + mins * 60 * 1000;
      }

      const msg = customMsg !== undefined ? customMsg : offlineMessage;

      const nextConfig: ArcadeConfig = {
        ...config,
        mode: selectedMode,
        offlineMessage: msg.trim(),
        bannedPlayers: config.bannedPlayers ?? [],
        forbiddenWords: config.forbiddenWords ?? [],
      };
      if (timerEndAt !== undefined) {
        nextConfig.timerEndAt = timerEndAt;
      }

      await updateArcadeConfig(nextConfig);
      setMode(selectedMode);
      toast.success(
        selectedMode === "always_on"
          ? "Arcade set to 24/7 Always Live!"
          : selectedMode === "timer"
          ? `Timer set for ${durationMin ?? timerMinutes} minutes.`
          : "Arcade set to Offline / Closed."
      );
    } catch (err) {
      console.error("[Save Arcade Settings Error]:", err);
      toast.error("Failed to save Arcade configuration.");
    } finally {
      setBusy(false);
    }
  };

  const [showResetModal, setShowResetModal] = useState(false);
  const [showLaunchModal, setShowLaunchModal] = useState(false);
  const [nextVersionInput, setNextVersionInput] = useState("v2.0");

  const confirmResetWeekly = async () => {
    setShowResetModal(false);
    setBusy(true);
    try {
      await resetWeeklyLeaderboard();
      toast.success("Weekly Leaderboard reset to 0! Lifetime scores remain 100% protected.");
      void refetch();
    } catch {
      toast.error("Failed to reset Weekly Leaderboard.");
    } finally {
      setBusy(false);
    }
  };

  const saveAnnouncement = async () => {
    setBusy(true);
    try {
      await updateArcadeConfig({
        ...config,
        announcement: {
          active: announcementActive,
          title: announcementTitle.trim(),
          message: announcementMessage.trim(),
          dateText: announcementDateText.trim(),
        },
      });
      toast.success("Announcement banner updated live!");
    } catch {
      toast.error("Failed to save announcement.");
    } finally {
      setBusy(false);
    }
  };

  const saveContest = async (newVersion?: string) => {
    setBusy(true);
    try {
      const v = newVersion ?? contestVersion;
      const startMs = contestStartAt ? new Date(contestStartAt).getTime() : Date.now();
      const endMs = contestEndAt ? new Date(contestEndAt).getTime() : Date.now() + 7 * 86400 * 1000;

      await updateArcadeConfig({
        ...config,
        contest: {
          id: `contest-${v.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
          version: v,
          title: contestTitle.trim(),
          description: contestDescription.trim(),
          startAt: startMs,
          endAt: endMs,
          active: contestActive,
          registrations: config.contest?.registrations ?? [],
        },
      });
      toast.success(`Contest ${v} configuration saved!`);
    } catch {
      toast.error("Failed to save contest settings.");
    } finally {
      setBusy(false);
    }
  };

  const archiveCurrentContest = async () => {
    if (!config.contest) return;
    const curVer = config.contest.version || "v1.0";
    const startAt = config.contest.startAt ?? 0;

    const contestRows = leaderboard.filter((r) => r.createdAt >= startAt);
    const winners = contestRows.slice(0, 10).map((r, idx) => ({
      rank: idx + 1,
      name: r.name,
      handle: r.handle,
      score: r.score,
      accuracy: r.accuracy,
    }));

    const archiveEntry = {
      version: curVer,
      title: config.contest.title || `Contest ${curVer}`,
      endedAt: Date.now(),
      totalRegistrations: (config.contest.registrations ?? []).length,
      winners,
    };

    const existingArchives = config.contestArchives ?? [];
    const updatedArchives = [
      archiveEntry,
      ...existingArchives.filter((a) => a.version !== curVer),
    ];

    setBusy(true);
    try {
      await updateArcadeConfig({
        ...config,
        contestArchives: updatedArchives,
      });
      toast.success(`Archived results for Contest ${curVer} (${winners.length} top players saved)!`);
    } catch {
      toast.error("Failed to archive contest results.");
    } finally {
      setBusy(false);
    }
  };

  const confirmLaunchNewVersion = async () => {
    const nextVer = nextVersionInput.trim() || "v2.0";
    setShowLaunchModal(false);
    setBusy(true);
    try {
      // Archive current version results first
      const curVer = config.contest?.version || "v1.0";
      const startAt = config.contest?.startAt ?? 0;
      const contestRows = leaderboard.filter((r) => r.createdAt >= startAt);
      const winners = contestRows.slice(0, 10).map((r, idx) => ({
        rank: idx + 1,
        name: r.name,
        handle: r.handle,
        score: r.score,
        accuracy: r.accuracy,
      }));

      const archiveEntry = {
        version: curVer,
        title: config.contest?.title || `Contest ${curVer}`,
        endedAt: Date.now(),
        totalRegistrations: (config.contest?.registrations ?? []).length,
        winners,
      };

      const existingArchives = config.contestArchives ?? [];
      const updatedArchives = [
        archiveEntry,
        ...existingArchives.filter((a) => a.version !== curVer),
      ];

      setContestVersion(nextVer);
      setContestTitle(`Signal Rush Championship ${nextVer}`);
      await updateArcadeConfig({
        ...config,
        contestArchives: updatedArchives,
        contest: {
          id: `contest-${nextVer.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
          version: nextVer,
          title: `Signal Rush Championship ${nextVer}`,
          description: `Compete against top players for the ${nextVer} Gold Crown!`,
          startAt: Date.now(),
          endAt: Date.now() + 7 * 86400 * 1000,
          active: true,
          registrations: [],
        },
      });
      setContestActive(true);
      toast.success(`Archived ${curVer} Results & Launched Contest ${nextVer}!`);
    } catch {
      toast.error("Failed to launch new contest version.");
    } finally {
      setBusy(false);
    }
  };

  const toggleBanPlayer = async (playerId: string, name: string) => {
    const currentBanned = config.bannedPlayers ?? [];
    const isBanned = currentBanned.includes(playerId);
    const nextBanned = isBanned
      ? currentBanned.filter((id) => id !== playerId)
      : [...currentBanned, playerId];

    setBusy(true);
    try {
      await updateArcadeConfig({
        ...config,
        bannedPlayers: nextBanned,
      });
      toast.success(isBanned ? `Unbanned ${name}.` : `Banned ${name} from playing.`);
    } catch {
      toast.error("Could not update ban status.");
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteScore = async (scoreId: string, name: string) => {
    if (!confirm(`Delete score entry for ${name}?`)) return;
    try {
      await deleteScore(scoreId);
      toast.success(`Deleted score entry for ${name}.`);
      void refetch();
    } catch {
      toast.error("Failed to delete score.");
    }
  };

  return (
    <div className="space-y-8">
      {/* Game Mode & Control Box */}
      <section className="plate p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="label">Control Room · Arcade</span>
            <h2 className="mt-2 text-[1.4rem] font-display text-ink">Arcade Live & Timer Settings</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void refetch()}
              className="press-btn-outline"
              title="Refresh Leaderboard & Config"
            >
              <RefreshCw className="size-3.5" /> Refresh
            </button>
          </div>
        </div>

        {/* Current Live Mode Indicator */}
        <div className="mt-6 rounded-2xl border border-ink/12 bg-paper-tint/50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "size-3.5 rounded-full animate-pulse",
                  mode === "always_on"
                    ? "bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.6)]"
                    : mode === "timer" && remainingSec > 0
                    ? "bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.6)]"
                    : "bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.6)]"
                )}
              />
              <span className="font-mono text-sm uppercase tracking-wider text-ink font-semibold">
                Status: {mode === "always_on" ? "24/7 Always Live" : mode === "timer" ? "Scheduled Timer Mode" : "Closed / Maintenance"}
              </span>
            </div>

            {mode === "timer" ? (
              <span className="rounded-full bg-amber-500/15 border border-amber-500/30 px-3 py-1 font-mono text-xs text-amber-600 dark:text-amber-300 font-semibold">
                ⏱️ {remainingSec > 0 ? `Remaining: ${formatCountdown(remainingSec)}` : "Timer Expired (Closed)"}
              </span>
            ) : null}
          </div>
        </div>

        {/* Mode Selector Buttons */}
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {/* Mode 1: Always On */}
          <button
            type="button"
            onClick={() => void saveSettings("always_on")}
            disabled={busy}
            className={cn(
              "flex flex-col items-start p-4 rounded-xl border transition-all text-left",
              mode === "always_on"
                ? "border-emerald-500 bg-emerald-500/10 text-ink shadow-sm"
                : "border-ink/12 bg-paper hover:border-ink/30 text-ink-soft"
            )}
          >
            <div className="flex items-center gap-2 font-mono text-xs uppercase font-semibold text-emerald-600 dark:text-emerald-400">
              <Gamepad2 className="size-4" /> 24/7 Unlimited
            </div>
            <p className="mt-2 text-xs text-ink-soft">Game stays live continuously without any timer limits.</p>
          </button>

          {/* Mode 2: Scheduled Timer */}
          <div
            className={cn(
              "flex flex-col items-start p-4 rounded-xl border transition-all text-left",
              mode === "timer"
                ? "border-amber-500 bg-amber-500/10 text-ink shadow-sm"
                : "border-ink/12 bg-paper hover:border-ink/30 text-ink-soft"
            )}
          >
            <div className="flex items-center justify-between w-full">
              <span className="flex items-center gap-2 font-mono text-xs uppercase font-semibold text-amber-600 dark:text-amber-400">
                <Clock className="size-4" /> Scheduled Timer
              </span>
            </div>
            <p className="mt-2 text-xs text-ink-soft">Game stays open only for a specific duration.</p>

            <div className="mt-3 flex items-center gap-2 w-full">
              <select
                value={timerMinutes}
                onChange={(e) => setTimerMinutes(Number(e.target.value))}
                className="rounded-lg border border-ink/15 bg-paper px-2 py-1 font-mono text-xs text-ink flex-1"
              >
                <option value={15}>15 Minutes</option>
                <option value={30}>30 Minutes</option>
                <option value={60}>1 Hour</option>
                <option value={120}>2 Hours</option>
                <option value={360}>6 Hours</option>
                <option value={1440}>24 Hours</option>
              </select>
              <button
                type="button"
                onClick={() => void saveSettings("timer")}
                disabled={busy}
                className="press-btn text-xs py-1 px-3"
              >
                Start
              </button>
            </div>
          </div>

          {/* Mode 3: Disabled / Closed */}
          <button
            type="button"
            onClick={() => void saveSettings("disabled")}
            disabled={busy}
            className={cn(
              "flex flex-col items-start p-4 rounded-xl border transition-all text-left",
              mode === "disabled"
                ? "border-rose-500 bg-rose-500/10 text-ink shadow-sm"
                : "border-ink/12 bg-paper hover:border-ink/30 text-ink-soft"
            )}
          >
            <div className="flex items-center gap-2 font-mono text-xs uppercase font-semibold text-rose-600 dark:text-rose-400">
              <Lock className="size-4" /> Closed / Offline
            </div>
            <p className="mt-2 text-xs text-ink-soft">Closes arcade completely and displays notice message.</p>
          </button>
        </div>

        {/* Custom Offline Notice Message Input */}
        <div className="mt-6 space-y-2">
          <label className="block">
            <span className="label">Custom Admin Notice Message</span>
            <span className="block text-xs text-ink-soft mt-0.5">
              Message shown to visitors on `/arcade` when the game is closed or timer expires.
            </span>
          </label>
          <div className="flex flex-col gap-2 sm:flex-row items-stretch sm:items-end">
            <textarea
              rows={2}
              value={offlineMessage}
              onChange={(e) => setOfflineMessage(e.target.value)}
              className="w-full rounded-xl border border-ink/15 bg-paper p-3 text-sm text-ink outline-none transition focus:border-chrome-1 flex-1"
              placeholder="Enter notice message for visitors..."
            />
            <button
              type="button"
              onClick={() => void saveSettings(mode, undefined, offlineMessage)}
              disabled={busy}
              className="press-btn justify-center shrink-0 py-3 px-4 text-xs font-semibold"
            >
              Save Message
            </button>
          </div>
        </div>
      </section>

      {/* Weekly Leaderboard Reset & Lifetime Rank Protection */}
      <section className="plate p-6 sm:p-8 border-l-4 border-l-emerald-500">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-3 py-1 font-mono text-[0.66rem] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="size-3.5" /> Lifetime Ranks 100% Protected
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/15 px-3 py-1 font-mono text-[0.66rem] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-300">
                <Zap className="size-3.5" /> Resets Weekly Ranks Only
              </span>
            </div>
            <h2 className="text-[1.4rem] font-display text-ink">Weekly Leaderboard Reset</h2>
            <p className="max-w-2xl text-xs leading-relaxed text-ink-soft">
              Clicking this button only zeroes out the <strong>Weekly Leaderboard</strong> scores for this week.
              Your <strong>Lifetime Hall of Fame</strong> scores, player IDs, and all-time achievements are <strong>permanently protected and will NEVER be deleted or modified</strong>.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowResetModal(true)}
            disabled={busy}
            className="inline-flex items-center justify-center gap-2.5 shrink-0 rounded-2xl bg-amber-500/20 border border-amber-500/50 px-5 py-3 font-mono text-xs uppercase font-bold text-amber-600 dark:text-amber-300 hover:bg-amber-500/30 hover:scale-105 transition-all shadow-sm"
          >
            <RotateCcw className="size-4" /> Reset Weekly Board (To 0)
          </button>
        </div>
      </section>

      {/* Public Announcement & Banner Manager */}
      <section className="plate p-6 sm:p-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <span className="label">Public Communication</span>
            <h2 className="mt-2 text-[1.4rem] font-display text-ink">Arcade Announcement Banner</h2>
            <p className="mt-1 text-xs text-ink-soft">
              Post an upcoming contest alert or news banner at the top of the `/arcade` page.
            </p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={announcementActive}
              onChange={(e) => setAnnouncementActive(e.target.checked)}
              className="size-4 rounded accent-chrome-1"
            />
            <span className="font-mono text-xs font-semibold uppercase text-ink">Banner Active</span>
          </label>
        </div>

        <div className="mt-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Banner Title</label>
              <input
                value={announcementTitle}
                onChange={(e) => setAnnouncementTitle(e.target.value)}
                placeholder="e.g. Upcoming Tournament!"
                className="mt-1 w-full rounded-xl border border-ink/15 bg-paper p-3 text-sm text-ink outline-none transition focus:border-chrome-1"
              />
            </div>
            <div>
              <label className="label">Schedule / Date Text</label>
              <input
                value={announcementDateText}
                onChange={(e) => setAnnouncementDateText(e.target.value)}
                placeholder="e.g. Sunday @ 8:00 PM IST"
                className="mt-1 w-full rounded-xl border border-ink/15 bg-paper p-3 text-sm text-ink outline-none transition focus:border-chrome-1"
              />
            </div>
          </div>

          <div>
            <label className="label">Announcement Message</label>
            <textarea
              rows={2}
              value={announcementMessage}
              onChange={(e) => setAnnouncementMessage(e.target.value)}
              placeholder="Enter announcement details for players..."
              className="mt-1 w-full rounded-xl border border-ink/15 bg-paper p-3 text-sm text-ink outline-none transition focus:border-chrome-1"
            />
          </div>

          <button
            type="button"
            onClick={() => void saveAnnouncement()}
            disabled={busy}
            className="press-btn justify-center py-2.5 px-6 text-xs font-semibold"
          >
            <Megaphone className="size-3.5" /> Save Announcement Banner
          </button>
        </div>
      </section>

      {/* Contest Registration & Version Manager */}
      <section className="plate p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="label">Tournament System</span>
            <h2 className="mt-2 text-[1.4rem] font-display text-ink">Contest Version & Registration</h2>
            <p className="mt-1 text-xs text-ink-soft">
              Manage contest versions (e.g. v1.0, v2.0), enable registrations, and track player signups.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowLaunchModal(true)}
              disabled={busy}
              className="press-btn"
            >
              <Sparkles className="size-3.5" /> Launch New Version (e.g. v2.0)
            </button>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label">Version Label</label>
              <input
                value={contestVersion}
                onChange={(e) => setContestVersion(e.target.value)}
                placeholder="v1.0"
                className="mt-1 w-full rounded-xl border border-ink/15 bg-paper p-3 text-sm text-ink outline-none transition focus:border-chrome-1 font-mono"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Contest Title</label>
              <input
                value={contestTitle}
                onChange={(e) => setContestTitle(e.target.value)}
                placeholder="Signal Rush Championship v1.0"
                className="mt-1 w-full rounded-xl border border-ink/15 bg-paper p-3 text-sm text-ink outline-none transition focus:border-chrome-1"
              />
            </div>
          </div>

          <div>
            <label className="label">Contest Description</label>
            <input
              value={contestDescription}
              onChange={(e) => setContestDescription(e.target.value)}
              placeholder="Compete against top players for the Gold Crown!"
              className="mt-1 w-full rounded-xl border border-ink/15 bg-paper p-3 text-sm text-ink outline-none transition focus:border-chrome-1"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Contest Start Time (Date & Time)</label>
              <input
                type="datetime-local"
                value={contestStartAt}
                onChange={(e) => setContestStartAt(e.target.value)}
                className="mt-1 w-full rounded-xl border border-ink/15 bg-paper p-3 text-sm text-ink outline-none transition focus:border-chrome-1 font-mono"
              />
            </div>
            <div>
              <label className="label">Contest End Time (Date & Time)</label>
              <input
                type="datetime-local"
                value={contestEndAt}
                onChange={(e) => setContestEndAt(e.target.value)}
                className="mt-1 w-full rounded-xl border border-ink/15 bg-paper p-3 text-sm text-ink outline-none transition focus:border-chrome-1 font-mono"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-ink/10 bg-paper-tint/30 p-4">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={contestActive}
                  onChange={(e) => setContestActive(e.target.checked)}
                  className="size-4 rounded accent-chrome-1"
                />
                <span className="font-mono text-xs font-semibold uppercase text-ink">Contest & Registration Live</span>
              </label>
            </div>
            <div className="font-mono text-xs text-ink-soft">
              Registered Players: <span className="font-bold text-ink font-mono">{(config.contest?.registrations ?? []).length} players</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => void saveContest()}
              disabled={busy}
              className="press-btn justify-center py-2.5 px-6 text-xs font-semibold"
            >
              <Trophy className="size-3.5" /> Save Contest Version Settings
            </button>
            <button
              type="button"
              onClick={() => void archiveCurrentContest()}
              disabled={busy}
              className="press-btn-outline border-amber-500/40 text-amber-600 dark:text-amber-300 hover:bg-amber-500/10 justify-center py-2.5 px-6 text-xs font-semibold"
            >
              <Lock className="size-3.5 text-amber-500" /> Freeze & Archive Current Results
            </button>
          </div>
        </div>

        {/* Contest Archives / Results History */}
        <div className="mt-8 border-t border-ink/10 pt-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <span className="label text-amber-500">Hall of Fame</span>
              <h3 className="text-lg font-display text-ink mt-1">Archived Contest Results & Winners</h3>
            </div>
            <span className="font-mono text-xs text-ink-soft">{(config.contestArchives ?? []).length} versions archived</span>
          </div>

          {(config.contestArchives ?? []).length > 0 ? (
            <div className="mt-4 grid gap-4">
              {(config.contestArchives ?? []).map((arch) => (
                <div key={arch.version} className="rounded-2xl border border-ink/12 bg-paper p-4 sm:p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 pb-3">
                    <div>
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 font-mono text-[0.7rem] font-bold text-amber-400">
                        🏆 Contest {arch.version}
                      </span>
                      <h4 className="mt-1 font-display text-base font-bold text-ink">{arch.title}</h4>
                    </div>
                    <div className="font-mono text-xs text-ink-soft text-right">
                      <p>{arch.totalRegistrations} Participants Registered</p>
                      <p className="text-[0.68rem] text-ink-soft/70">Ended: {new Date(arch.endedAt).toLocaleDateString()}</p>
                    </div>
                  </div>

                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-left font-sans text-xs">
                      <thead>
                        <tr className="font-mono uppercase text-[0.65rem] tracking-wider text-ink-soft border-b border-ink/10">
                          <th className="py-2">Rank</th>
                          <th className="py-2">Player</th>
                          <th className="py-2">Score</th>
                          <th className="py-2">Accuracy</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-ink/10">
                        {(arch.winners ?? []).map((w) => (
                          <tr key={w.rank}>
                            <td className="py-2 font-mono font-bold">
                              {w.rank === 1 ? "🥇 1st" : w.rank === 2 ? "🥈 2nd" : w.rank === 3 ? "🥉 3rd" : `#${w.rank}`}
                            </td>
                            <td className="py-2 font-semibold text-ink">{w.name} ({w.handle})</td>
                            <td className="py-2 font-mono font-bold text-amber-400">{Math.round(w.score).toLocaleString()}</td>
                            <td className="py-2 font-mono text-ink-soft">{Math.round(w.accuracy)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="caption mt-3">No archived contest results yet. Click "Freeze & Archive Current Results" or "Launch New Version" to save version standings.</p>
          )}
        </div>
      </section>

      {/* Anti-Cheat & Moderation Panel */}
      <section className="plate p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="label">Anti-Cheat & Player Banning</span>
            <h2 className="mt-2 text-[1.4rem] font-display text-ink">Leaderboard Moderation ({leaderboard.length})</h2>
          </div>
        </div>

        {/* Leaderboard Moderation Table */}
        <div className="mt-6 overflow-x-auto rounded-2xl border border-ink/12 bg-paper-tint/30">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-ink/10 font-mono text-[0.68rem] uppercase tracking-wider text-ink-soft">
                <th className="p-3">Rank</th>
                <th className="p-3">Player</th>
                <th className="p-3">Score</th>
                <th className="p-3">Accuracy</th>
                <th className="p-3">Combo</th>
                <th className="p-3">Flag / Anti-Cheat</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/10 font-sans text-sm">
              {leaderboard.map((row) => {
                const isBanned = (config.bannedPlayers ?? []).includes(row.playerId);
                const isSuspicious = row.score > 25000 || (row.accuracy === 100 && row.score > 15000);

                return (
                  <tr
                    key={row.id}
                    className={cn(
                      "transition-colors hover:bg-paper/60",
                      isBanned ? "bg-rose-500/10" : isSuspicious ? "bg-amber-500/10" : ""
                    )}
                  >
                    <td className="p-3 font-mono font-semibold text-ink">#{row.rank}</td>
                    <td className="p-3">
                      <div className="font-semibold text-ink">{row.name}</div>
                      <div className="font-mono text-xs text-ink-soft">{row.handle}</div>
                    </td>
                    <td className="p-3 font-mono text-ink font-semibold">{row.score.toLocaleString()}</td>
                    <td className="p-3 font-mono text-ink-soft">{row.accuracy}%</td>
                    <td className="p-3 font-mono text-ink-soft">x{row.combo}</td>
                    <td className="p-3">
                      {isBanned ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-600 dark:text-rose-300 font-mono text-[0.68rem] uppercase font-semibold">
                          <Ban className="size-3" /> Banned
                        </span>
                      ) : isSuspicious ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-300 font-mono text-[0.68rem] uppercase font-semibold">
                          <AlertTriangle className="size-3" /> High Score
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-mono">
                          <CheckCircle2 className="size-3" /> Normal
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => void toggleBanPlayer(row.playerId, row.name)}
                          disabled={busy}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-lg px-2.5 py-1 font-mono text-xs uppercase font-medium border transition-colors",
                            isBanned
                              ? "border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10"
                              : "border-rose-500/40 text-rose-600 hover:bg-rose-500/10"
                          )}
                        >
                          <Ban className="size-3" /> {isBanned ? "Unban" : "Ban"}
                        </button>

                        <button
                          type="button"
                          onClick={() => void handleDeleteScore(row.id, row.name)}
                          className="p-1.5 rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors"
                          title="Delete Score"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Profanity & Bad Words Censorship Panel */}
      <section className="plate p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="label">Profanity & Abuse Control</span>
            <h2 className="mt-2 text-[1.4rem] font-display text-ink">Forbidden Words Filter</h2>
            <p className="mt-1 text-xs text-ink-soft">
              Names containing any of these words will be blocked automatically on registration.
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          {/* Add Bad Word Input */}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const term = newWord.trim().toLowerCase();
              if (!term) return;
              const currentList = config.forbiddenWords ?? DEFAULT_FORBIDDEN_WORDS;
              if (currentList.map((w) => w.toLowerCase()).includes(term)) {
                toast.info(`"${term}" is already in the forbidden words list.`);
                setNewWord("");
                return;
              }
              const nextList = [...currentList, term];
              setBusy(true);
              try {
                await updateArcadeConfig({ ...config, forbiddenWords: nextList });
                toast.success(`Added "${term}" to forbidden words.`);
                setNewWord("");
              } catch {
                toast.error("Could not update forbidden words.");
              } finally {
                setBusy(false);
              }
            }}
            className="flex flex-col gap-3 sm:flex-row"
          >
            <input
              value={newWord}
              onChange={(e) => setNewWord(e.target.value)}
              placeholder="Type word or phrase to block..."
              className="flex-1 rounded-xl border border-ink/15 bg-paper p-3 text-sm text-ink outline-none transition focus:border-chrome-1"
            />
            <button
              type="submit"
              disabled={busy || !newWord.trim()}
              className="press-btn justify-center py-3 px-6 shrink-0 disabled:opacity-50"
            >
              Add Bad Word
            </button>
          </form>

          {/* Active Forbidden Words Badges */}
          <div className="rounded-2xl border border-ink/12 bg-paper-tint/30 p-4">
            <span className="font-mono text-xs font-semibold uppercase tracking-wider text-ink-soft">
              Blocked Words List ({ (config.forbiddenWords ?? DEFAULT_FORBIDDEN_WORDS).length })
            </span>
            <div className="mt-3 flex flex-wrap gap-2">
              {(config.forbiddenWords ?? DEFAULT_FORBIDDEN_WORDS).map((word) => (
                <span
                  key={word}
                  className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 font-mono text-xs text-rose-600 dark:text-rose-400"
                >
                  {word}
                  <button
                    type="button"
                    onClick={async () => {
                      const currentList = config.forbiddenWords ?? DEFAULT_FORBIDDEN_WORDS;
                      const nextList = currentList.filter((w) => w.toLowerCase() !== word.toLowerCase());
                      setBusy(true);
                      try {
                        await updateArcadeConfig({ ...config, forbiddenWords: nextList });
                        toast.success(`Removed "${word}" from forbidden list.`);
                      } catch {
                        toast.error("Could not update list.");
                      } finally {
                        setBusy(false);
                      }
                    }}
                    className="hover:opacity-75 transition-opacity"
                    title={`Remove "${word}"`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Custom Reset Weekly Confirmation Modal */}
      {showResetModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-md animate-fade-in">
          <div className="plate max-w-md w-full p-6 space-y-5 border-amber-500/40 shadow-2xl">
            <div className="flex items-center gap-3 text-amber-500">
              <span className="flex size-10 items-center justify-center rounded-2xl bg-amber-500/15 border border-amber-500/30">
                <AlertTriangle className="size-5" />
              </span>
              <div>
                <span className="label text-amber-500 font-bold">Leaderboard Reset</span>
                <h3 className="font-display text-xl text-ink">Reset Weekly Scores to 0?</h3>
              </div>
            </div>

            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 space-y-1">
              <div className="flex items-center gap-2 text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 uppercase">
                <CheckCircle2 className="size-4" /> Lifetime Ranks 100% Protected
              </div>
              <p className="text-xs text-ink-soft leading-relaxed">
                All-time Hall of Fame rankings, certificates, and player accounts are completely safe and will <strong>NOT</strong> be deleted.
              </p>
            </div>

            <p className="text-xs text-ink-soft leading-relaxed">
              This action will reset the <strong>Weekly Leaderboard</strong> scores to zero for a brand new weekly competition.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="press-btn-outline text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmResetWeekly()}
                disabled={busy}
                className="press-btn bg-amber-500 text-slate-950 hover:bg-amber-400 text-xs font-bold"
              >
                <RotateCcw className="size-3.5" /> Yes, Reset Weekly Board
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Custom Launch New Version Modal */}
      {showLaunchModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-md animate-fade-in">
          <div className="plate max-w-md w-full p-6 space-y-5 border-chrome-1/40 shadow-2xl">
            <div className="flex items-center gap-3 text-chrome-1">
              <span className="flex size-10 items-center justify-center rounded-2xl bg-chrome-1/15 border border-chrome-1/30">
                <Sparkles className="size-5" />
              </span>
              <div>
                <span className="label text-chrome-1 font-bold">Tournament Launcher</span>
                <h3 className="font-display text-xl text-ink">Launch New Contest Version</h3>
              </div>
            </div>

            <div className="space-y-2">
              <label className="label">Version Label</label>
              <input
                value={nextVersionInput}
                onChange={(e) => setNextVersionInput(e.target.value)}
                placeholder="e.g. v2.0, v3.0, v2.5"
                className="w-full rounded-xl border border-ink/15 bg-paper p-3 text-sm text-ink outline-none transition focus:border-chrome-1 font-mono"
              />
              <p className="text-[0.72rem] text-ink-soft">
                This creates a brand new tournament version, resets registration list, and opens registration for players.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowLaunchModal(false)}
                className="press-btn-outline text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmLaunchNewVersion()}
                disabled={busy || !nextVersionInput.trim()}
                className="press-btn text-xs font-bold"
              >
                <Sparkles className="size-3.5" /> Launch {nextVersionInput || "v2.0"} & Open Registrations
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
