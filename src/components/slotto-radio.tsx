"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type Track = {
  src: string;
  title: string;
  artist: string;
  href: string;
};

const TRACKS: Track[] = [
  {
    src: "/radio/the-draw-walks.mp3",
    title: "The Draw Walks",
    artist: "retrospect82",
    href: "https://x.com/retrospect82",
  },
  {
    src: "/radio/one-draw-many-worlds.mp3",
    title: "One Draw, Many Worlds",
    artist: "retrospect82",
    href: "https://x.com/retrospect82",
  },
  {
    src: "/radio/every-month.mp3",
    title: "Every Month",
    artist: "feedle_",
    href: "https://x.com/feedle_",
  },
];

type RadioContextValue = {
  track: Track;
  index: number;
  playing: boolean;
  open: boolean;
  currentTime: number;
  duration: number;
  toggleOpen: () => void;
  togglePlay: () => void;
  next: () => void;
  prev: () => void;
  seek: (seconds: number) => void;
};

const RadioContext = createContext<RadioContextValue | null>(null);

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function SlottoRadioProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [open, setOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const indexRef = useRef(0);
  const wantPlayRef = useRef(false);

  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  const playCurrent = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    wantPlayRef.current = true;
    try {
      await audio.play();
      setPlaying(true);
    } catch {
      setPlaying(false);
    }
  }, []);

  const goTo = useCallback((nextIndex: number, autoplay: boolean) => {
    const wrapped = (nextIndex + TRACKS.length) % TRACKS.length;
    wantPlayRef.current = autoplay;
    setCurrentTime(0);
    setIndex(wrapped);
    if (!autoplay) setPlaying(false);
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const nextSrc = TRACKS[index]!.src;
    if (!audio.src.endsWith(nextSrc)) {
      audio.src = nextSrc;
    }
    if (wantPlayRef.current) void playCurrent();
  }, [index, playCurrent]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setCurrentTime(audio.currentTime);
    const onMeta = () => setDuration(audio.duration || 0);
    const onEnded = () => goTo(indexRef.current + 1, true);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("durationchange", onMeta);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("durationchange", onMeta);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
    };
  }, [goTo]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) void playCurrent();
    else audio.pause();
  }, [playCurrent]);

  const toggleOpen = useCallback(() => {
    setOpen((was) => {
      const next = !was;
      if (next) {
        const audio = audioRef.current;
        if (audio?.paused) void playCurrent();
      }
      return next;
    });
  }, [playCurrent]);

  const value = useMemo<RadioContextValue>(
    () => ({
      track: TRACKS[index]!,
      index,
      playing,
      open,
      currentTime,
      duration,
      toggleOpen,
      togglePlay,
      next: () => goTo(indexRef.current + 1, playing),
      prev: () => goTo(indexRef.current - 1, playing),
      seek: (seconds: number) => {
        const audio = audioRef.current;
        if (!audio) return;
        audio.currentTime = seconds;
        setCurrentTime(seconds);
      },
    }),
    [index, playing, open, currentTime, duration, toggleOpen, togglePlay, goTo],
  );

  return (
    <RadioContext.Provider value={value}>
      <audio ref={audioRef} preload="metadata" />
      {children}
    </RadioContext.Provider>
  );
}

function useRadio(): RadioContextValue {
  const value = useContext(RadioContext);
  if (!value) throw new Error("SlottoRadioButton must sit inside SlottoRadioProvider");
  return value;
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid h-8 w-8 place-items-center rounded-full text-accent-gold transition hover:bg-white/10"
    >
      {children}
    </button>
  );
}

/** Round Slotto Radio control, meant to sit on the top-left of the mascot. */
export function SlottoRadioButton({ panel = "left" }: { panel?: "left" | "right" }) {
  const radio = useRadio();
  const { track } = radio;

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      <button
        type="button"
        aria-label={radio.open ? "Close Slotto Radio" : "Slotto Radio"}
        aria-expanded={radio.open}
        onClick={radio.toggleOpen}
        className="pointer-events-auto absolute left-[5%] top-[18%] grid h-11 w-11 place-items-center rounded-full border border-accent-gold/70 bg-bg-deep/80 text-accent-gold shadow-lg shadow-black/40 backdrop-blur-md transition hover:border-accent-gold hover:bg-bg-deep"
      >
        {radio.playing ? (
          <span className="flex h-4 items-end gap-0.5" aria-hidden>
            <span className="w-0.5 animate-pulse bg-accent-gold" style={{ height: "40%" }} />
            <span className="w-0.5 animate-pulse bg-accent-gold [animation-delay:150ms]" style={{ height: "100%" }} />
            <span className="w-0.5 animate-pulse bg-accent-gold [animation-delay:300ms]" style={{ height: "65%" }} />
          </span>
        ) : (
          <svg viewBox="0 0 20 20" className="ml-0.5 h-4 w-4 fill-current" aria-hidden>
            <path d="M6 4.5v11l10-5.5-10-5.5z" />
          </svg>
        )}
      </button>

      {radio.open ? (
        <div
          className={`pointer-events-auto absolute w-64 rounded-2xl border border-border bg-bg-elevated/95 p-3 text-left shadow-xl shadow-black/50 backdrop-blur-md ${
            panel === "right"
              ? "right-0 top-full mt-2"
              : "left-[5%] top-[calc(18%+3rem)]"
          }`}
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent-gold">
            Slotto Radio
          </p>
          <p className="mt-1 truncate text-sm font-medium text-foreground">{track.title}</p>
          <p className="mt-0.5 text-xs text-muted">
            by{" "}
            <a
              href={track.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-cyan hover:underline"
            >
              @{track.artist}
            </a>
          </p>

          <div className="mt-3 flex items-center gap-1">
            <IconButton label="Previous tune" onClick={radio.prev}>
              <svg viewBox="0 0 20 20" className="h-4 w-4 fill-current" aria-hidden>
                <path d="M4 4h2v12H4V4zm12 0-8 6 8 6V4z" />
              </svg>
            </IconButton>
            <IconButton label={radio.playing ? "Pause" : "Play"} onClick={radio.togglePlay}>
              {radio.playing ? (
                <svg viewBox="0 0 20 20" className="h-4 w-4 fill-current" aria-hidden>
                  <path d="M5 4h3.5v12H5V4zm6.5 0H15v12h-3.5V4z" />
                </svg>
              ) : (
                <svg viewBox="0 0 20 20" className="ml-0.5 h-4 w-4 fill-current" aria-hidden>
                  <path d="M6 4.5v11l10-5.5-10-5.5z" />
                </svg>
              )}
            </IconButton>
            <IconButton label="Next tune" onClick={radio.next}>
              <svg viewBox="0 0 20 20" className="h-4 w-4 fill-current" aria-hidden>
                <path d="M14 4h2v12h-2V4zM4 4l8 6-8 6V4z" />
              </svg>
            </IconButton>
            <span className="ml-auto text-[10px] tabular-nums text-muted">
              {formatTime(radio.currentTime)} / {formatTime(radio.duration)}
            </span>
          </div>

          <input
            type="range"
            min={0}
            max={radio.duration || 0}
            step={0.1}
            value={Math.min(radio.currentTime, radio.duration || 0)}
            aria-label="Seek"
            onChange={(e) => radio.seek(Number(e.target.value))}
            className="mt-2 h-1 w-full cursor-pointer accent-accent-gold"
          />
        </div>
      ) : null}
    </div>
  );
}
