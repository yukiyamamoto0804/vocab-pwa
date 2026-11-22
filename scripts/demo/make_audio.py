"""デモ教材の音声を作る（docs/specs/demo-pack.md 4 章、docs/RULES.md 11 章）。

使い方（依存は scripts/demo/requirements.txt。ffmpeg も必要。scripts/demo/README.md）:
    python -I -B scripts/demo/make_audio.py make   --model <kokoro-v1.0.onnx> --voices <voices-v1.0.bin> [demo フォルダ]
    python -I -B scripts/demo/make_audio.py verify --model <kokoro-v1.0.onnx> --voices <voices-v1.0.bin> [demo フォルダ]

make:   demo/items.json の単語と例文を読み上げて demo/audio/ に並べ、区間を測って audio・exampleAudio を書き込み、
        生成の記録 demo/audio-sources.json を書く
verify: 記録の文を読み上げ直し、make と同じ処理（並べる → 圧縮 → 測り直す）をして、記録の長さ・区間と合うかを確かめる
"""

import argparse
import hashlib
import json
import math
import re
import shutil
import subprocess
import sys
import tempfile
from importlib.metadata import PackageNotFoundError, version
from pathlib import Path

import numpy as np
import soundfile as sf

TOOL_VERSION = "2"
VOICE = "af_heart"
RATE = 24000  # Kokoro の出力

LEAD = 0.3  # ファイルの先頭と末尾の無音（秒）。最初の項目の前にも、AAC の頭のずれを吸収する無音を置く
GAP = 0.4  # 区間と区間の間の無音（秒）。AAC の頭のずれを吸収する（docs/RULES.md 11 章）
PAD_BEFORE = 0.05  # 測った音の前に足す余裕（秒）
PAD_AFTER = 0.15  # 測った音の後ろに足す余裕（秒）。頭の無音を取り除かない再生環境では音が後ろにずれるので、多めにする
FRAME = 0.01  # 音の有無を判定する単位（秒）
MEASURE_TOLERANCE = 0.15  # 測った位置が並べた位置より外側にずれてよい上限（秒）
VERIFY_TOLERANCE = 0.05  # 作り直したときの長さ・区間の差の上限（秒。docs/specs/demo-pack.md 4 章）

WORD_BITRATE = "64k"
EXAMPLE_BITRATE = "24k"
EXAMPLES_PER_FILE = 10
# 例文のファイル 1 本の長さの上限（秒）。区間を鳴らすときはファイル全体を読み解くので、1 本を短く保つ（1 分以内）
EXAMPLE_FILE_MAX = 55.0

# 生成の記録に版を書くライブラリ（作り直せるようにするため。docs/RULES.md 11 章）
LIBRARIES = ["kokoro-onnx", "onnxruntime", "phonemizer", "espeakng-loader", "numpy", "soundfile"]


def fail(message: str) -> None:
    sys.exit(f"デモ教材の音声: {message}")


# ---- 音声の処理 ----


def run(*args: str) -> str:
    try:
        return subprocess.run(args, check=True, capture_output=True, text=True).stdout
    except subprocess.CalledProcessError as e:
        fail(f"{args[0]} が失敗した: {e.stderr.strip()}")


def ffmpeg_versions() -> dict:
    """ffmpeg と libavcodec（圧縮の結果に効く）の版の番号だけを返す。
    配布物によっては版の文字列に OS や入手元が入るので、数字の部分だけを取る（docs/RULES.md 6 章）"""
    out = run("ffmpeg", "-version")
    ffmpeg = re.search(r"^ffmpeg version n?(\d+(?:\.\d+)+)", out, re.M)
    codec = re.search(r"^libavcodec\s+\d+\.\s*\d+\.\s*\d+\s*/\s*(\d+)\.\s*(\d+)\.\s*(\d+)", out, re.M)
    if not ffmpeg or not codec:
        fail("ffmpeg の版の番号を読み取れない（記録が作り直しに役立たなくなるので止める）")
    return {"ffmpeg": ffmpeg.group(1), "libavcodec": ".".join(codec.groups())}


def library_versions() -> dict:
    versions = {}
    for name in LIBRARIES:
        try:
            versions[name] = version(name)
        except PackageNotFoundError:
            fail(f"ライブラリ {name} が見つからない（scripts/demo/requirements.txt を入れる）")
    return versions


def encode(signal: np.ndarray, bitrate: str, out: Path) -> None:
    out.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        wav = Path(tmp) / "a.wav"
        sf.write(wav, signal, RATE, subtype="PCM_16")
        # 内蔵の AAC エンコーダ（LGPL）を使う。nonfree のエンコーダは使わない
        run("ffmpeg", "-y", "-loglevel", "error", "-i", str(wav), "-c:a", "aac", "-profile:a", "aac_low",
            "-b:a", bitrate, "-ac", "1", "-map_metadata", "-1", str(out))


def decode(path: Path, ignore_editlist: bool = False) -> np.ndarray:
    """読み解く。ignore_editlist にすると、圧縮で頭に足された無音を取り除かずに読む（そう再生する環境に合わせて測るため）"""
    with tempfile.TemporaryDirectory() as tmp:
        wav = Path(tmp) / "a.wav"
        opts = ["-ignore_editlist", "1"] if ignore_editlist else []
        run("ffmpeg", "-y", "-loglevel", "error", *opts, "-i", str(path), "-ac", "1", "-ar", str(RATE),
            "-c:a", "pcm_s16le", str(wav))
        data, _ = sf.read(wav, dtype="float32")
    return data


def frame_rms(signal: np.ndarray) -> np.ndarray:
    n = int(RATE * FRAME)
    frames = len(signal) // n
    return np.sqrt((signal[: frames * n].reshape(frames, n) ** 2).mean(axis=1) + 1e-12)


def trim(signal: np.ndarray) -> np.ndarray:
    """合成した音声の前後の無音を落とす（20 ミリ秒の余裕を残す）"""
    rms = frame_rms(signal)
    idx = np.nonzero(rms > max(rms.max() * 10 ** (-50 / 20), 1e-4))[0]
    if not len(idx):
        return signal[:0]
    pad, n = int(RATE * 0.02), int(RATE * FRAME)
    return signal[max(idx[0] * n - pad, 0) : min((idx[-1] + 1) * n + pad, len(signal))]


def fade(clip: np.ndarray) -> np.ndarray:
    """切り口でプツッと鳴らないよう、両端を 5 ミリ秒で滑らかにする"""
    n = min(int(RATE * 0.005), len(clip) // 2)
    if n:
        ramp = np.linspace(0, 1, n, dtype=np.float32)
        clip = clip.copy()
        clip[:n] *= ramp
        clip[-n:] *= ramp[::-1]
    return clip


def assemble(clips: list) -> tuple:
    """無音を挟んで並べる。並べた信号と、各区間の位置（秒）を返す"""
    lead, gap = np.zeros(int(RATE * LEAD), np.float32), np.zeros(int(RATE * GAP), np.float32)
    parts, spans, pos = [lead], [], len(lead)
    for i, clip in enumerate(clips):
        if i:
            parts.append(gap)
            pos += len(gap)
        spans.append((pos / RATE, (pos + len(clip)) / RATE))
        parts.append(clip)
        pos += len(clip)
    parts.append(lead)
    return np.concatenate(parts), spans


def measured_spans(signal: np.ndarray, spans: list, name: str) -> list:
    """読み解いた信号で、並べた区間ごとに音のある範囲を測る"""
    rms = frame_rms(signal)
    active = rms > max(rms.max() * 10 ** (-50 / 20), 1e-4)
    result = []
    for i, (s, e) in enumerate(spans):
        lo = max(int((s - (LEAD if i == 0 else GAP / 2)) / FRAME), 0)
        hi = min(int((e + GAP / 2) / FRAME), len(active))
        idx = np.nonzero(active[lo:hi])[0]
        if not len(idx):
            fail(f"{name} {i + 1} 番目: 音が見つからない")
        ms, me = (lo + idx[0]) * FRAME, (lo + idx[-1] + 1) * FRAME
        # 内側に測れるのは弱い音で始まる・終わる項目で、区間は並べた位置で保つので問題ない。外側へのずれだけを止める
        if ms < s - MEASURE_TOLERANCE or me > e + MEASURE_TOLERANCE:
            fail(f"{name} {i + 1} 番目: 並べた位置 {s:.3f}-{e:.3f} より外側で音を測った（{ms:.3f}-{me:.3f}）")
        result.append((ms, me))
    return result


def measure(m4a: Path, spans: list) -> list:
    """圧縮したファイルを読み直して区間を測り直す。
    頭の無音を取り除いて読んだ場合と取り除かずに読んだ場合の両方で測り、並べた位置と合わせた広いほうに余裕を足す"""
    plain = measured_spans(decode(m4a), spans, m4a.name)
    raw = measured_spans(decode(m4a, ignore_editlist=True), spans, m4a.name)
    result = []
    for (s, e), (ps, pe), (rs, re_) in zip(spans, plain, raw):
        start, end = max(min(s, ps, rs) - PAD_BEFORE, 0), max(e, pe, re_) + PAD_AFTER
        result.append({"start": round(start, 3), "end": round(end, 3)})
    for a, b in zip(result, result[1:]):
        if a["end"] >= b["start"]:
            fail(f"{m4a.name}: 区間が重なる {a} / {b}")
    return result


# ---- 読み上げる項目の並べ方 ----


def plan(items: list) -> list:
    """作る音声ファイルの一覧。各ファイルに入れる項目（単語の id・用法の番号・読み上げる文）の並び"""
    files = []
    for unit in sorted({it["unit"] for it in items}):
        in_unit = [it for it in items if it["unit"] == unit]
        files.append({
            "file": f"demo-words-{unit}.m4a",
            "bitrate": WORD_BITRATE,
            "entries": [{"id": it["id"], "sense": None, "text": it["word"]} for it in in_unit],
        })
        examples = [{"id": it["id"], "sense": n, "text": s["example"]}
                    for it in in_unit for n, s in enumerate(it["senses"], 1)]
        count = max(math.ceil(len(examples) / EXAMPLES_PER_FILE), 1)
        size = math.ceil(len(examples) / count)
        for k in range(count):
            group = examples[k * size : (k + 1) * size]
            if group:
                files.append({"file": f"demo-examples-{unit}-{k + 1}.m4a", "bitrate": EXAMPLE_BITRATE, "entries": group})
    return files


class Speaker:
    def __init__(self, model: Path, voices: Path):
        for path in (model, voices):
            if not path.is_file():
                fail(f"{path} がない（scripts/demo/README.md の手順で取得する）")
        from kokoro_onnx import Kokoro

        self.kokoro = Kokoro(str(model), str(voices))

    def clip(self, text: str) -> np.ndarray:
        samples, rate = self.kokoro.create(text, voice=VOICE, speed=1.0, lang="en-us")
        if rate != RATE:
            fail(f"読み上げの標本化周波数が {RATE} ではない（{rate}）: {text}")
        clip = trim(np.asarray(samples, dtype=np.float32))
        if len(clip) / RATE < 0.2:
            fail(f"読み上げた音声が短すぎる（{len(clip) / RATE:.2f} 秒）: {text}")
        return fade(clip)


def sha256(path: Path) -> str:
    with path.open("rb") as f:
        return hashlib.file_digest(f, "sha256").hexdigest()


def duration(path: Path) -> float:
    return round(len(decode(path)) / RATE, 3)


def build(speaker: Speaker, f: dict, out: Path) -> tuple:
    """1 本の音声ファイルを作り、測り直した区間と長さを返す（make と verify で同じ処理を通す）"""
    joined, spans = assemble([speaker.clip(e["text"]) for e in f["entries"]])
    if f["bitrate"] == EXAMPLE_BITRATE and len(joined) / RATE > EXAMPLE_FILE_MAX + 2 * LEAD:
        fail(f"{f['file']}: 長すぎる（{len(joined) / RATE:.1f} 秒）")
    encode(joined, f["bitrate"], out)
    return measure(out, spans), duration(out)


# ---- make / verify ----


def make(demo: Path, speaker: Speaker, model: Path, voices: Path) -> None:
    items_path = demo / "items.json"
    items = json.loads(items_path.read_text(encoding="utf-8"))
    by_key, records = {}, []
    # 一時フォルダに全部作ってから置き換える（途中で失敗したときに、古い音声と記録の組を壊さないため）
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        for f in plan(items):
            out = tmp / f["file"]
            measured, length = build(speaker, f, out)
            entries = []
            for e, m in zip(f["entries"], measured):
                entries.append({**e, **m})
                by_key[(e["id"], e["sense"])] = {"file": f["file"], **m}
            records.append({"file": f["file"], "bitrate": f["bitrate"], "sha256": sha256(out), "duration": length,
                            "entries": entries})
            print(f"{f['file']}: {len(entries)} 項目", flush=True)

        audio_dir = demo / "audio"
        audio_dir.mkdir(exist_ok=True)
        for old in audio_dir.glob("demo-*.m4a"):
            old.unlink()
        for f in records:
            shutil.move(str(tmp / f["file"]), audio_dir / f["file"])

    for it in items:
        it["audio"] = by_key[(it["id"], None)]
        for n, s in enumerate(it["senses"], 1):
            s["exampleAudio"] = by_key[(it["id"], n)]
    items_path.write_text(json.dumps(items, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    sources = {
        "tool": TOOL_VERSION,
        "voice": VOICE,
        "model": {"file": model.name, "sha256": sha256(model)},
        "voices": {"file": voices.name, "sha256": sha256(voices)},
        **ffmpeg_versions(),
        "libraries": library_versions(),
        "files": records,
    }
    (demo / "audio-sources.json").write_text(json.dumps(sources, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"音声 {len(records)} ファイルを作り、items.json と audio-sources.json を書いた")


def verify(demo: Path, speaker: Speaker, model: Path, voices: Path) -> None:
    try:
        sources = json.loads((demo / "audio-sources.json").read_text(encoding="utf-8"))
        files = sources["files"]
        recorded = {"tool": sources["tool"], "voice": sources["voice"], "model": sources["model"]["sha256"],
                    "voices": sources["voices"]["sha256"]}
    except (OSError, ValueError, KeyError, TypeError) as e:
        fail(f"audio-sources.json を読めない（{e!r}）")
    # 作り方そのものが記録と違うなら、長さの食い違いより先にそれを伝える
    errors = []
    current = {"tool": TOOL_VERSION, "voice": VOICE, "model": sha256(model), "voices": sha256(voices)}
    for key, value in current.items():
        if recorded[key] != value:
            errors.append(f"{key} が記録と違う（記録 {recorded[key]}、今 {value}）")
    if errors:
        fail("\n".join(errors))

    with tempfile.TemporaryDirectory() as tmp:
        for f in files:
            path = demo / "audio" / f["file"]
            if not path.exists():
                errors.append(f"{f['file']} がない")
                continue
            if sha256(path) != f["sha256"]:
                errors.append(f"{f['file']} の SHA-256 が記録と違う")
            measured, length = build(speaker, f, Path(tmp) / f["file"])
            if abs(length - f["duration"]) > VERIFY_TOLERANCE:
                errors.append(f"{f['file']}: 作り直した長さ {length} 秒が記録 {f['duration']} 秒と合わない")
            for e, m in zip(f["entries"], measured):
                if abs(m["start"] - e["start"]) > VERIFY_TOLERANCE or abs(m["end"] - e["end"]) > VERIFY_TOLERANCE:
                    errors.append(f"{f['file']} の {e['id']} 用法 {e['sense']}: 作り直した区間 "
                                  f"{m['start']}-{m['end']} が記録 {e['start']}-{e['end']} と合わない")
            print(f"{f['file']}: 確かめた", flush=True)
    if errors:
        fail("\n".join(errors))
    print("音声の記録の確かめ: 合格")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("command", choices=["make", "verify"])
    parser.add_argument("demo", nargs="?", default="demo", type=Path)
    parser.add_argument("--model", required=True, type=Path)
    parser.add_argument("--voices", required=True, type=Path)
    args = parser.parse_intermixed_args()
    if not shutil.which("ffmpeg"):
        fail("ffmpeg が見つからない（各自インストールする。scripts/demo/README.md）")
    speaker = Speaker(args.model, args.voices)
    (make if args.command == "make" else verify)(args.demo, speaker, args.model, args.voices)


if __name__ == "__main__":
    main()
