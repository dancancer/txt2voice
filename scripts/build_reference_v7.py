#!/usr/bin/env python3
import argparse
import csv
import copy
import math
import re
import subprocess
import tempfile
import wave
from dataclasses import asdict, dataclass
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Sequence, Tuple

import numpy as np
from faster_whisper import WhisperModel


SOURCE = Path(
    "/Users/xupeng/mycode/txt2voice/uploads/reference-prep/sample_20260303/sample.cleaned.v3.raw.master.wav"
)
OUT_BASE = Path(
    "/Users/xupeng/mycode/txt2voice/uploads/reference-prep/sample_20260304_v7_blacklist_clustered"
)

BLACK_MARGIN_SEC = 3.0
MIN_SEG_SEC = 1.8
MAX_SEG_SEC = 8.5
TARGET_SELECT = 12
MIN_TIME_GAP = 40.0
DEFAULT_MANUAL_EXCLUDE_WINDOWS = [
    (3050.0, 3125.0),  # 用户反馈存在背景口播/广告混入
    (4300.0, 4334.6),  # 尾段广告口播区
]
MANUAL_EXCLUDE_WINDOWS = copy.deepcopy(DEFAULT_MANUAL_EXCLUDE_WINDOWS)

BLACKLIST_KEYWORDS = [
    "请大家支持",
    "支持正版",
    "正版",
    "点赞",
    "订阅",
    "关注",
    "公众号",
    "私信",
    "vx",
    "v信",
    "微信",
    "qq",
    "购买",
    "下单",
    "链接",
    "官网",
    "客服",
]
BLACKLIST_RE = re.compile("|".join(re.escape(k) for k in BLACKLIST_KEYWORDS), re.IGNORECASE)
CJK_RE = re.compile(r"[\u4e00-\u9fff]")


@dataclass
class Clip:
    idx: int
    start: float
    end: float
    duration: float
    peak_db: float
    rms_db: float
    zcr: float
    flatness: float
    centroid_n: float
    hf_ratio: float
    dynamic_db: float
    asr_text: str
    chars_per_sec: float
    quality_score: float
    cluster: int = -1


def sh(cmd: Sequence[str], capture: bool = False) -> str:
    if capture:
        return subprocess.run(cmd, check=True, text=True, capture_output=True).stdout
    subprocess.run(cmd, check=True)
    return ""


def ffprobe_duration(path: Path) -> float:
    out = sh(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=nw=1:nk=1",
            str(path),
        ],
        capture=True,
    )
    return float(out.strip())


def normalize_text(t: str) -> str:
    return re.sub(r"\s+", "", t or "").lower()


def text_is_blacklisted(text: str) -> bool:
    t = normalize_text(text)
    if not t:
        return False
    if BLACKLIST_RE.search(t):
        return True
    digit_count = sum(ch.isdigit() for ch in t)
    if re.search(r"\d{6,}", t):
        return True
    if len(t) >= 12 and digit_count >= 6 and digit_count / max(len(t), 1) >= 0.35:
        return True
    return False


def merge_intervals(intervals: Sequence[Tuple[float, float]], eps: float = 1e-6) -> List[Tuple[float, float]]:
    if not intervals:
        return []
    arr = sorted((float(a), float(b)) for a, b in intervals if b > a)
    merged = [arr[0]]
    for s, e in arr[1:]:
        ls, le = merged[-1]
        if s <= le + eps:
            merged[-1] = (ls, max(le, e))
        else:
            merged.append((s, e))
    return merged


def subtract_blocks(interval: Tuple[float, float], blocks: Sequence[Tuple[float, float]]) -> List[Tuple[float, float]]:
    pieces = [interval]
    for bs, be in blocks:
        updated: List[Tuple[float, float]] = []
        for s, e in pieces:
            if be <= s or bs >= e:
                updated.append((s, e))
                continue
            if bs > s:
                updated.append((s, bs))
            if be < e:
                updated.append((be, e))
        pieces = updated
        if not pieces:
            break
    return pieces


def detect_blacklist_segments_full(model: WhisperModel, duration: float) -> List[Tuple[float, float, str]]:
    hits: List[Tuple[float, float, str]] = []
    print("[1/6] transcribe full audio for blacklist...")
    segments, _ = model.transcribe(str(SOURCE), language="zh", beam_size=2, vad_filter=True)
    for seg in segments:
        text = (seg.text or "").strip()
        if not text:
            continue
        if text_is_blacklisted(text):
            s = max(0.0, float(seg.start) - BLACK_MARGIN_SEC)
            e = min(duration, float(seg.end) + BLACK_MARGIN_SEC)
            hits.append((s, e, text))
    return hits


def parse_nonsilent_intervals(duration: float) -> List[Tuple[float, float]]:
    print("[2/6] detect non-silent intervals...")
    proc = subprocess.run(
        [
            "ffmpeg",
            "-hide_banner",
            "-i",
            str(SOURCE),
            "-af",
            "silencedetect=noise=-42dB:d=0.20",
            "-f",
            "null",
            "-",
        ],
        text=True,
        capture_output=True,
        check=True,
    )

    silences: List[Tuple[float, float]] = []
    cur_start = None
    for line in proc.stderr.splitlines():
        m1 = re.search(r"silence_start:\s*([0-9.]+)", line)
        if m1:
            cur_start = float(m1.group(1))
            continue
        m2 = re.search(r"silence_end:\s*([0-9.]+)", line)
        if m2 and cur_start is not None:
            silences.append((cur_start, float(m2.group(1))))
            cur_start = None
    if cur_start is not None:
        silences.append((cur_start, duration))

    silences = merge_intervals(silences)
    nonsilent: List[Tuple[float, float]] = []
    cur = 0.0
    for s, e in silences:
        if s > cur:
            nonsilent.append((cur, s))
        cur = max(cur, e)
    if cur < duration:
        nonsilent.append((cur, duration))
    return [(s, e) for s, e in nonsilent if e - s >= MIN_SEG_SEC]


def split_interval(s: float, e: float) -> List[Tuple[float, float]]:
    dur = e - s
    if dur < MIN_SEG_SEC:
        return []
    if dur <= MAX_SEG_SEC:
        return [(s, e)]
    out: List[Tuple[float, float]] = []
    stride = 5.0
    size = 6.8
    cur = s
    while cur < e:
        ce = min(e, cur + size)
        if ce - cur >= MIN_SEG_SEC:
            out.append((cur, ce))
        if ce >= e:
            break
        cur += stride
    return out


def read_mono_wav(path: Path) -> Tuple[np.ndarray, int]:
    with wave.open(str(path), "rb") as wf:
        channels = wf.getnchannels()
        sampwidth = wf.getsampwidth()
        sr = wf.getframerate()
        frames = wf.readframes(wf.getnframes())
    if sampwidth != 2:
        raise ValueError(f"unsupported sample width: {sampwidth}")
    x = np.frombuffer(frames, dtype=np.int16).astype(np.float32) / 32768.0
    if channels == 2:
        x = x.reshape(-1, 2).mean(axis=1)
    elif channels != 1:
        x = x.reshape(-1, channels).mean(axis=1)
    return x, sr


def audio_features(x: np.ndarray, sr: int) -> Dict[str, float]:
    eps = 1e-12
    peak = float(np.max(np.abs(x)) + eps)
    rms = float(np.sqrt(np.mean(np.square(x)) + eps))
    peak_db = 20.0 * math.log10(peak)
    rms_db = 20.0 * math.log10(rms)

    frame = int(0.025 * sr)
    hop = int(0.010 * sr)
    if len(x) < frame + hop:
        zcr = float(np.mean(np.abs(np.diff(np.signbit(x).astype(np.int8)))))
        return {
            "peak_db": peak_db,
            "rms_db": rms_db,
            "zcr": zcr,
            "flatness": 0.0,
            "centroid_n": 0.0,
            "hf_ratio": 0.0,
            "dynamic_db": 0.0,
        }

    n = 1 + (len(x) - frame) // hop
    idx = np.arange(frame)[None, :] + np.arange(n)[:, None] * hop
    frames = x[idx] * np.hanning(frame)[None, :]
    f_rms = np.sqrt(np.mean(frames * frames, axis=1) + eps)
    f_db = 20.0 * np.log10(f_rms + eps)
    dynamic_db = float(np.percentile(f_db, 90) - np.percentile(f_db, 10))

    signs = np.sign(frames)
    zcr = float(np.mean(np.abs(np.diff(signs, axis=1)) > 0))

    spec = np.abs(np.fft.rfft(frames, axis=1)) ** 2 + eps
    freqs = np.fft.rfftfreq(frame, d=1.0 / sr)
    centroid = np.sum(spec * freqs[None, :], axis=1) / np.sum(spec, axis=1)
    centroid_n = float(np.mean(centroid) / (sr / 2.0))
    flatness = np.exp(np.mean(np.log(spec), axis=1)) / np.mean(spec, axis=1)
    flatness = float(np.mean(flatness))
    hf_mask = freqs >= 4000
    hf_ratio = float(np.mean(np.sum(spec[:, hf_mask], axis=1) / np.sum(spec, axis=1)))

    return {
        "peak_db": peak_db,
        "rms_db": rms_db,
        "zcr": zcr,
        "flatness": flatness,
        "centroid_n": centroid_n,
        "hf_ratio": hf_ratio,
        "dynamic_db": dynamic_db,
    }


def passes_acoustic_gate(feat: Dict[str, float]) -> bool:
    if feat["rms_db"] < -38.0 or feat["rms_db"] > -15.5:
        return False
    if feat["peak_db"] > -0.5 or feat["peak_db"] < -30.0:
        return False
    if feat["zcr"] > 0.18:
        return False
    if feat["flatness"] > 0.40:
        return False
    if feat["hf_ratio"] > 0.70:
        return False
    if feat["dynamic_db"] < 2.5:
        return False
    return True


def run_kmeans(x: np.ndarray, k: int, rounds: int = 8, iters: int = 40) -> np.ndarray:
    best_labels = None
    best_inertia = None
    n = x.shape[0]
    if n == 0:
        return np.zeros(0, dtype=np.int32)
    k = max(1, min(k, n))
    for seed in range(rounds):
        rng = np.random.default_rng(seed + 7)
        init_idx = rng.choice(n, size=k, replace=False)
        cent = x[init_idx].copy()
        labels = np.zeros(n, dtype=np.int32)
        for _ in range(iters):
            d2 = np.sum((x[:, None, :] - cent[None, :, :]) ** 2, axis=2)
            new_labels = np.argmin(d2, axis=1)
            if np.array_equal(new_labels, labels):
                break
            labels = new_labels
            for i in range(k):
                m = x[labels == i]
                if len(m) == 0:
                    cent[i] = x[rng.integers(0, n)]
                else:
                    cent[i] = m.mean(axis=0)
        inertia = float(np.sum((x - cent[labels]) ** 2))
        if best_inertia is None or inertia < best_inertia:
            best_inertia = inertia
            best_labels = labels.copy()
    return best_labels if best_labels is not None else np.zeros(n, dtype=np.int32)


def parse_window(raw: str) -> Tuple[float, float]:
    m = re.match(r"^\s*([0-9]+(?:\.[0-9]+)?)\s*[:,-]\s*([0-9]+(?:\.[0-9]+)?)\s*$", raw)
    if not m:
        raise argparse.ArgumentTypeError(f"invalid window: {raw}, expected start:end")
    a = float(m.group(1))
    b = float(m.group(2))
    if b <= a:
        raise argparse.ArgumentTypeError(f"invalid window: {raw}, end must > start")
    return (a, b)


def default_out_base_for(source: Path) -> Path:
    date_tag = datetime.now().strftime("%Y%m%d")
    return source.parent / "reference-prep" / f"{source.stem}_{date_tag}_v7_blacklist_clustered"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build v7 reference clips with blacklist + clustering")
    parser.add_argument("--source", type=Path, default=SOURCE)
    parser.add_argument("--out-base", type=Path, default=None)
    parser.add_argument("--target-select", type=int, default=TARGET_SELECT)
    parser.add_argument("--min-time-gap", type=float, default=MIN_TIME_GAP)
    parser.add_argument("--no-default-exclude", action="store_true")
    parser.add_argument("--exclude-window", action="append", type=parse_window, default=[])
    return parser.parse_args()


def main() -> None:
    global SOURCE, OUT_BASE, TARGET_SELECT, MIN_TIME_GAP, MANUAL_EXCLUDE_WINDOWS

    args = parse_args()
    SOURCE = args.source.resolve()
    if not SOURCE.exists():
        raise FileNotFoundError(f"source not found: {SOURCE}")
    if args.out_base is None:
        OUT_BASE = default_out_base_for(SOURCE)
    else:
        OUT_BASE = args.out_base.resolve()
    TARGET_SELECT = max(1, int(args.target_select))
    MIN_TIME_GAP = max(0.0, float(args.min_time_gap))
    if args.no_default_exclude:
        MANUAL_EXCLUDE_WINDOWS = list(args.exclude_window)
    else:
        MANUAL_EXCLUDE_WINDOWS = list(DEFAULT_MANUAL_EXCLUDE_WINDOWS) + list(args.exclude_window)

    print(f"source={SOURCE}")
    print(f"out_base={OUT_BASE}")
    print(f"target_select={TARGET_SELECT}, min_time_gap={MIN_TIME_GAP}")
    print(f"manual_excludes={MANUAL_EXCLUDE_WINDOWS}")

    out_master = OUT_BASE / "reference_candidates_v7_blacklist_clustered_raw" / "master_48k_stereo"
    out_clone = OUT_BASE / "reference_candidates_v7_blacklist_clustered_raw" / "clone_24k_mono"
    tmp_dir = OUT_BASE / "tmp"
    for p in [OUT_BASE, out_master, out_clone, tmp_dir]:
        p.mkdir(parents=True, exist_ok=True)

    duration = ffprobe_duration(SOURCE)
    asr_model = WhisperModel("tiny", device="cpu", compute_type="int8")

    black_hits = detect_blacklist_segments_full(asr_model, duration)
    black_blocks = merge_intervals([(s, e) for s, e, _ in black_hits] + MANUAL_EXCLUDE_WINDOWS)
    print(f"black hits={len(black_hits)}, merged blocks={len(black_blocks)}")

    with (OUT_BASE / "blacklist_windows_v7.csv").open("w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["start", "end", "duration", "text"])
        for s, e, t in black_hits:
            w.writerow([f"{s:.3f}", f"{e:.3f}", f"{(e - s):.3f}", t])

    nonsilent = parse_nonsilent_intervals(duration)
    clean_intervals: List[Tuple[float, float]] = []
    for s, e in nonsilent:
        clean_intervals.extend(subtract_blocks((s, e), black_blocks))
    clean_intervals = [(s, e) for s, e in clean_intervals if e - s >= MIN_SEG_SEC]

    print("[3/6] split clean intervals...")
    candidates: List[Tuple[float, float]] = []
    for s, e in clean_intervals:
        candidates.extend(split_interval(s, e))

    with (OUT_BASE / "candidates_v7_all.csv").open("w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["idx", "start", "end", "duration"])
        for i, (s, e) in enumerate(candidates, start=1):
            w.writerow([i, f"{s:.3f}", f"{e:.3f}", f"{(e - s):.3f}"])

    print(f"candidates total={len(candidates)}")
    print("[4/6] acoustic+asr filtering...")

    selected_pool: List[Clip] = []
    rejected: List[Tuple[int, float, float, str]] = []

    for i, (s, e) in enumerate(candidates, start=1):
        d = e - s
        with tempfile.NamedTemporaryFile(suffix=".wav", dir=tmp_dir, delete=False) as tmp:
            t16 = Path(tmp.name)
        sh(
            [
                "ffmpeg",
                "-y",
                "-hide_banner",
                "-loglevel",
                "error",
                "-ss",
                f"{s:.3f}",
                "-t",
                f"{d:.3f}",
                "-i",
                str(SOURCE),
                "-ac",
                "1",
                "-ar",
                "16000",
                str(t16),
            ]
        )
        try:
            x, sr = read_mono_wav(t16)
            feat = audio_features(x, sr)
            if not passes_acoustic_gate(feat):
                rejected.append((i, s, d, "acoustic_gate"))
                continue

            segs, _ = asr_model.transcribe(str(t16), language="zh", beam_size=2, vad_filter=True)
            text = "".join(seg.text for seg in segs).strip()
            if not text:
                rejected.append((i, s, d, "asr_empty"))
                continue
            if text_is_blacklisted(text):
                rejected.append((i, s, d, "blacklist_text"))
                continue

            cjk = len(CJK_RE.findall(text))
            if cjk < 3:
                rejected.append((i, s, d, "too_few_cjk"))
                continue

            digit = sum(ch.isdigit() for ch in text)
            if digit / max(len(text), 1) > 0.2:
                rejected.append((i, s, d, "digit_heavy"))
                continue

            cps = cjk / d
            if cps < 1.2 or cps > 10.0:
                rejected.append((i, s, d, "pace_outlier"))
                continue

            q = 0.0
            q -= abs(feat["rms_db"] + 23.0) * 0.8
            q -= feat["flatness"] * 28.0
            q -= feat["zcr"] * 16.0
            q -= max(0.0, feat["hf_ratio"] - 0.35) * 18.0
            q += min(feat["dynamic_db"], 18.0) * 0.16
            q += min(cjk, 40) * 0.05
            q -= abs(d - 5.5) * 0.3

            selected_pool.append(
                Clip(
                    idx=i,
                    start=s,
                    end=e,
                    duration=d,
                    peak_db=feat["peak_db"],
                    rms_db=feat["rms_db"],
                    zcr=feat["zcr"],
                    flatness=feat["flatness"],
                    centroid_n=feat["centroid_n"],
                    hf_ratio=feat["hf_ratio"],
                    dynamic_db=feat["dynamic_db"],
                    asr_text=text,
                    chars_per_sec=cps,
                    quality_score=q,
                )
            )
        finally:
            t16.unlink(missing_ok=True)

        if i % 100 == 0:
            print(f"  processed={i}/{len(candidates)}, kept={len(selected_pool)}")

    with (OUT_BASE / "rejected_v7.csv").open("w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["idx", "start", "duration", "reason"])
        for row in rejected:
            w.writerow([row[0], f"{row[1]:.3f}", f"{row[2]:.3f}", row[3]])

    if not selected_pool:
        raise RuntimeError("no candidates left after filtering")

    print(f"[5/6] clustering from kept={len(selected_pool)}")
    x = np.array(
        [
            [
                c.rms_db,
                c.zcr,
                c.flatness,
                c.centroid_n,
                c.hf_ratio,
                c.dynamic_db,
                c.chars_per_sec,
                c.start / duration,
            ]
            for c in selected_pool
        ],
        dtype=np.float32,
    )
    mu = x.mean(axis=0, keepdims=True)
    sd = x.std(axis=0, keepdims=True) + 1e-6
    xz = (x - mu) / sd
    k = min(6, max(1, len(selected_pool) // 5 + 1))
    labels = run_kmeans(xz, k=k)
    for c, lb in zip(selected_pool, labels):
        c.cluster = int(lb)

    by_cluster: Dict[int, List[Clip]] = {}
    for c in selected_pool:
        by_cluster.setdefault(c.cluster, []).append(c)
    for arr in by_cluster.values():
        arr.sort(key=lambda c: c.quality_score, reverse=True)

    chosen: List[Clip] = []
    pointers = {k0: 0 for k0 in by_cluster.keys()}
    cluster_keys = sorted(by_cluster.keys())

    def far_enough(t: float, arr: List[Clip], gap: float) -> bool:
        return all(abs(t - x.start) >= gap for x in arr)

    while len(chosen) < TARGET_SELECT:
        changed = False
        for ck in cluster_keys:
            arr = by_cluster[ck]
            p = pointers[ck]
            while p < len(arr) and not far_enough(arr[p].start, chosen, MIN_TIME_GAP):
                p += 1
            pointers[ck] = p
            if p < len(arr):
                chosen.append(arr[p])
                pointers[ck] += 1
                changed = True
                if len(chosen) >= TARGET_SELECT:
                    break
        if not changed:
            break

    if len(chosen) < TARGET_SELECT:
        rest = sorted(selected_pool, key=lambda c: c.quality_score, reverse=True)
        for c in rest:
            if c in chosen:
                continue
            if far_enough(c.start, chosen, MIN_TIME_GAP * 0.5):
                chosen.append(c)
            if len(chosen) >= TARGET_SELECT:
                break

    if len(chosen) < TARGET_SELECT:
        rest = sorted(selected_pool, key=lambda c: c.quality_score, reverse=True)
        for c in rest:
            if c in chosen:
                continue
            chosen.append(c)
            if len(chosen) >= TARGET_SELECT:
                break

    chosen = sorted(chosen[:TARGET_SELECT], key=lambda c: c.start)

    with (OUT_BASE / "candidates_v7_filtered.csv").open("w", newline="") as f:
        fields = list(asdict(selected_pool[0]).keys())
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        for c in sorted(selected_pool, key=lambda x: x.quality_score, reverse=True):
            w.writerow(asdict(c))

    print("[6/6] export selected clips...")
    with (OUT_BASE / "selected_v7_blacklist_clustered.csv").open("w", newline="") as f:
        fields = ["name"] + list(asdict(chosen[0]).keys())
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        for i, c in enumerate(chosen, start=1):
            name = f"sample_ref_v7_{i:02d}.wav"
            row = asdict(c)
            row = {k: (f"{v:.6f}" if isinstance(v, float) else v) for k, v in row.items()}
            row["name"] = name
            w.writerow(row)

            out48 = out_master / name
            out24 = out_clone / name
            sh(
                [
                    "ffmpeg",
                    "-y",
                    "-hide_banner",
                    "-loglevel",
                    "error",
                    "-ss",
                    f"{c.start:.3f}",
                    "-t",
                    f"{c.duration:.3f}",
                    "-i",
                    str(SOURCE),
                    "-c:a",
                    "pcm_s16le",
                    str(out48),
                ]
            )
            sh(
                [
                    "ffmpeg",
                    "-y",
                    "-hide_banner",
                    "-loglevel",
                    "error",
                    "-ss",
                    f"{c.start:.3f}",
                    "-t",
                    f"{c.duration:.3f}",
                    "-i",
                    str(SOURCE),
                    "-ac",
                    "1",
                    "-ar",
                    "24000",
                    "-c:a",
                    "pcm_s16le",
                    str(out24),
                ]
            )

    summary = OUT_BASE / "v7_summary.txt"
    with summary.open("w") as f:
        f.write(f"duration_sec={duration:.3f}\n")
        f.write(f"black_windows={len(black_hits)}\n")
        f.write(f"black_blocks_merged={len(black_blocks)}\n")
        f.write(f"nonsilent_intervals={len(nonsilent)}\n")
        f.write(f"clean_intervals={len(clean_intervals)}\n")
        f.write(f"candidates_total={len(candidates)}\n")
        f.write(f"candidates_filtered={len(selected_pool)}\n")
        f.write(f"selected={len(chosen)}\n")

    print(summary.read_text())
    print(f"done: {OUT_BASE}")


if __name__ == "__main__":
    main()
