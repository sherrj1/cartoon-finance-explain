"""Build the video: voice-over -> timings -> scene renders (parallel) -> concat + mux.

usage: python3 build.py [--preview] [--only N] [--out DIR]
"""
import argparse, json, os, re, subprocess, sys, wave
from multiprocessing import Pool

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
SCRATCH = os.environ.get("BUILD_DIR", "/tmp/claude-0/-home-user-cartoon-finance-explain/68b39eae-bb6a-58c2-8d36-663a506679ef/scratchpad/build")
MODELS = os.environ.get("KOKORO_DIR", "/tmp/claude-0/-home-user-cartoon-finance-explain/68b39eae-bb6a-58c2-8d36-663a506679ef/scratchpad/models")
SR = 24000
VOICE = "am_michael"
SPEED = 1.08
FPS = 30


def trim(x, thr=0.015):
    idx = np.where(np.abs(x) > thr)[0]
    return x[idx[0]: idx[-1] + 1] if len(idx) else x


def make_voice(scenes):
    """Returns per-scene (wav_samples, speech_seconds). Cached on disk."""
    import soundfile as sf
    from kokoro_onnx import Kokoro
    os.makedirs(SCRATCH, exist_ok=True)
    k = None
    out = []
    for i, sc in enumerate(scenes):
        if not sc.get("say"):
            out.append((np.zeros(0, dtype=np.float32), 0.0)); continue
        f = os.path.join(SCRATCH, f"vo_{i:02d}.wav")
        key = os.path.join(SCRATCH, f"vo_{i:02d}.txt")
        if not (os.path.exists(f) and os.path.exists(key) and open(key).read() == sc["say"] + VOICE + str(SPEED)):
            if k is None:
                k = Kokoro(os.path.join(MODELS, "kokoro-v1.0.onnx"), os.path.join(MODELS, "voices-v1.0.bin"))
            x, sr = k.create(sc["say"], voice=VOICE, speed=SPEED, lang="en-us")
            x = trim(x)
            x = x / max(1e-6, np.abs(x).max()) * 0.9
            sf.write(f, x, sr)
            open(key, "w").write(sc["say"] + VOICE + str(SPEED))
        x, sr = sf.read(f, dtype="float32")
        out.append((x, len(x) / sr))
    return out


def word_times(text, speech_start, speech_len):
    toks = text.split()
    wts = []
    for t in toks:
        w = len(re.sub(r"\W", "", t)) + 2.0
        if t[-1] in ".!?:":
            w += 2.5
        elif t[-1] == ",":
            w += 1.2
        wts.append(w)
    tot = sum(wts)
    t0, res = speech_start, []
    for t, w in zip(toks, wts):
        d = speech_len * w / tot
        res.append((t0, t0 + d, t.upper()))
        t0 += d
    return res


def plan(scenes, voice):
    """Scene durations (frame-aligned) + word timings + one continuous audio track."""
    lead = 0.12
    plans, audio, cursor = [], [], 0.0
    for sc, (x, sl) in zip(scenes, voice):
        if sc.get("end_card"):
            dur = 2.0
            plans.append(dict(dur=dur, start=cursor, words=[]))
            audio.append(np.zeros(int(dur * SR), dtype=np.float32)); cursor += dur
            continue
        ends_sentence = sc["say"].strip()[-1] in ".!?"
        tail = 0.30 if ends_sentence else 0.14
        dur = max(1.7, lead + sl + tail)
        nf = round(dur * FPS); dur = nf / FPS
        words = word_times(sc["text"], lead, sl)
        track = np.zeros(int(dur * SR), dtype=np.float32)
        a0 = int(lead * SR)
        track[a0: a0 + len(x)] = x[: len(track) - a0]
        plans.append(dict(dur=dur, start=cursor, words=words))
        audio.append(track); cursor += dur
    return plans, np.concatenate(audio)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--preview", action="store_true", help="only dump one still per scene")
    ap.add_argument("--only", type=int, nargs="*")
    ap.add_argument("--out", default=os.path.join(HERE, "..", "output"))
    a = ap.parse_args()
    from scenes import SCENES
    import engine
    os.makedirs(SCRATCH, exist_ok=True)
    os.makedirs(a.out, exist_ok=True)
    voice = make_voice(SCENES)
    plans, audio = plan(SCENES, voice)
    total = sum(p["dur"] for p in plans)
    print(f"{len(SCENES)} scenes, {total:.1f}s")

    if a.preview:
        from PIL import Image
        stills = []
        for i, (sc, p) in enumerate(zip(SCENES, plans)):
            if a.only and i not in a.only:
                continue
            if sc.get("end_card"):
                continue
            bg = engine.bg_image(sc.get("bg", "day"), sc.get("ground"), sc.get("ground_y", 1080))
            fr_list = [0.0] + [bt[0] for bt in sc.get("beats", [])] + [1.0]
            for k in range(len(fr_list) - 1):
                f0, f1 = fr_list[k], fr_list[k + 1]
                t = f0 * p["dur"] + min(1.0, 0.7 * (f1 - f0) * p["dur"])
                fr = engine.frame_scene(sc, bg, min(t, p["dur"] - 0.04), p["dur"], p["words"])
                stills.append(fr.resize((216, 384)))
        for s in range(0, len(stills), 24):
            chunk = stills[s: s + 24]
            sheet = Image.new("RGB", (216 * 8, 384 * 3), (0, 0, 0))
            for j, im in enumerate(chunk):
                sheet.paste(im, ((j % 8) * 216, (j // 8) * 384))
            sheet.save(os.path.join(SCRATCH, f"beats_{s // 24}.jpg"), quality=85)
        print(len(stills), "beats")
        return

    jobs = [dict(scene=sc, dur=p["dur"], words=p["words"], out=os.path.join(SCRATCH, f"seg_{i:02d}.mp4"))
            for i, (sc, p) in enumerate(zip(SCENES, plans))]
    with Pool(4) as pool:
        segs = pool.map(engine.render_scene, jobs)
    lst = os.path.join(SCRATCH, "list.txt")
    open(lst, "w").write("".join(f"file '{s}'\n" for s in segs))
    wav = os.path.join(SCRATCH, "vo_all.wav")
    import soundfile as sf
    sf.write(wav, audio, SR)
    out = os.path.join(a.out, "real-estate-investment-p1.mp4")
    subprocess.check_call(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-i", wav,
                           "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
                           "-shortest", "-movflags", "+faststart", out])
    json.dump([dict(scene=i, start=round(p["start"], 2), dur=round(p["dur"], 2)) for i, p in enumerate(plans)],
              open(os.path.join(a.out, "timings.json"), "w"), indent=1)
    print("wrote", out)


if __name__ == "__main__":
    main()
