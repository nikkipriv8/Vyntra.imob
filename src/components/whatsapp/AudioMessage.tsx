import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  src: string;
  transcription?: string | null;
  transcriptionStatus?: string | null;
};

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function AudioMessage({ src, transcription, transcriptionStatus }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const progress = useMemo(() => {
    if (!duration) return 0;
    return Math.min(1, Math.max(0, currentTime / duration));
  }, [currentTime, duration]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    const onLoaded = () => setDuration(el.duration || 0);
    const onTime = () => setCurrentTime(el.currentTime || 0);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => setIsPlaying(false);

    el.addEventListener("loadedmetadata", onLoaded);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("ended", onEnded);
    return () => {
      el.removeEventListener("loadedmetadata", onLoaded);
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("ended", onEnded);
    };
  }, []);

  const toggle = async () => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) await el.play();
    else el.pause();
  };

  const seek = (next: number) => {
    const el = audioRef.current;
    if (!el || !duration) return;
    el.currentTime = Math.min(duration, Math.max(0, next));
  };

  return (
    <div className="rounded-lg border border-border bg-muted/40 p-2 animate-fade-in">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={toggle}
          className={cn(
            "h-9 w-9 rounded-full grid place-items-center border border-border bg-background",
            "hover-scale"
          )}
          aria-label={isPlaying ? "Pausar áudio" : "Reproduzir áudio"}
        >
          {isPlaying ? (
            <Pause className="h-4 w-4 text-foreground" />
          ) : (
            <Play className="h-4 w-4 text-foreground" />
          )}
        </button>

        <div className="flex-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Volume2 className="h-3.5 w-3.5" />
              Áudio
            </div>
            <div className="text-[11px] text-muted-foreground tabular-nums">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
          </div>

          <div className="mt-1">
            <div className="relative h-2 rounded-full bg-muted">
              <div
                className={cn(
                  "absolute left-0 top-0 h-2 rounded-full bg-primary",
                  isPlaying && "pulse"
                )}
                style={{ width: `${progress * 100}%` }}
              />
              <input
                type="range"
                min={0}
                max={Math.max(duration, 0)}
                step={0.1}
                value={Math.min(currentTime, duration || 0)}
                onChange={(e) => seek(Number(e.target.value))}
                className="absolute inset-0 w-full opacity-0 cursor-pointer"
                aria-label="Progresso do áudio"
              />
            </div>
          </div>
        </div>
      </div>

      <audio ref={audioRef} preload="metadata" src={src} />

      {transcriptionStatus === "pending" && (
        <p className="mt-2 text-xs text-muted-foreground">Transcrevendo áudio…</p>
      )}

      {transcription && (
        <div className="mt-2 rounded-md bg-background/60 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
            Transcrição
          </p>
          <p className="text-xs whitespace-pre-wrap break-words">{transcription}</p>
        </div>
      )}

      {transcriptionStatus === "error" && !transcription && (
        <p className="mt-2 text-xs text-muted-foreground">
          Não foi possível transcrever este áudio.
        </p>
      )}
    </div>
  );
}
