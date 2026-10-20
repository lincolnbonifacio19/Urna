"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

let ctx: AudioContext | null = null;
let audio: HTMLAudioElement | null = null;
let liberado = false;

function prep() {
  try {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!ctx) ctx = new AC();
    ctx.resume();
  } catch {}
}
function liberarAudio() {
  try {
    if (!audio) { audio = new Audio("/som.mp3"); audio.preload = "auto"; }
    if (liberado) return;
    liberado = true;
    audio.muted = true;
    audio.play().then(() => { audio!.pause(); audio!.currentTime = 0; audio!.muted = false; })
      .catch(() => { liberado = false; if (audio) audio.muted = false; });
  } catch {}
}
function tom(inicio: number, dur: number, freq = 1000) {
  try {
    if (!ctx) return;
    const t = ctx.currentTime + inicio;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "square";
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.2, t + 0.01);
    g.gain.setValueAtTime(0.2, t + dur - 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(ctx.destination);
    o.start(t); o.stop(t + dur + 0.02);
  } catch {}
}
function somTecla() { prep(); liberarAudio(); tom(0, 0.04, 800); }
function somConfirma() {
  try {
    if (!audio) audio = new Audio("/som.mp3");
    audio.muted = false; audio.currentTime = 0;
    audio.play().catch(() => {});
  } catch {}
}

export default function Urna() {
  const { id } = useParams<{ id: string }>();
  const [el, setEl] = useState<any>(null);
  const [pos, setPos] = useState<any[]>([]);
  const [cands, setCands] = useState<any[]>([]);
  const [i, setI] = useState(0);
  const [digits, setDigits] = useState("");
  const [blank, setBlank] = useState(false);
  const [fim, setFim] = useState(false);
  const [already, setAlready] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const token = useRef<string>(crypto.randomUUID());

  useEffect(() => { (async () => {
    const { data: e } = await supabase.from("elections").select("*").eq("id", id).single();
    const { data: p } = await supabase.from("positions").select("*").eq("election_id", id).order("sort");
    const { data: c } = await supabase.from("candidates").select("*").in("position_id", (p ?? []).map(x => x.id)).order("sort");
    setEl(e); setPos(p ?? []); setCands(c ?? []);
    try { setAlready(localStorage.getItem("voted:" + id) === "r" + (e?.round ?? 0)); } catch {}
  })(); }, [id]);

  const cur = pos[i];
  const full = cur && digits.length === cur.digits;
  const cand = full ? cands.find(c => c.position_id === cur.id && c.number === digits) : null;
  const press = useCallback((d: string) => {
    if (!cur || blank || busy || already) return;
    somTecla();
    setDigits(v => (v.length < cur.digits ? v + d : v));
  }, [cur, blank, busy, already]);
  const corrige = () => { setDigits(""); setBlank(false); setErr(""); };
  const confirma = async () => {
    if (busy || already || !cur || !(blank || full)) return;
    prep(); liberarAudio();
    setBusy(true); setErr("");
    const { error } = await supabase.rpc("cast_vote", {
      p_position: cur.id, p_kind: blank ? "blank" : "candidate", p_number: digits, p_token: token.current });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    somConfirma();
    token.current = crypto.randomUUID(); corrige();
    if (i + 1 < pos.length) setI(i + 1);
    else {
      try { localStorage.setItem("voted:" + id, "r" + (el.round ?? 0)); } catch {}
      setFim(true);
      setTimeout(() => { setFim(false); setAlready(true); }, 4000);
    }
  };
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === "Enter") confirma();
      else if (e.key === "Backspace" || e.key === "Escape") corrige();
    };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  });

  if (!el) return <p className="p-6">Carregando…</p>;
  const color = el.primary_color;
  const open = el.status === "open";
  const Key = ({ k }: { k: string }) => (
    <button onClick={() => press(k)} className="h-14 rounded-lg bg-zinc-800 text-2xl font-bold text-white active:scale-95 transition">{k}</button>);

  return (
    <main className="min-h-screen bg-zinc-200 p-3 flex items-center justify-center">
      <div className="grid w-full max-w-4xl gap-3 rounded-2xl bg-zinc-300 p-4 shadow-xl md:grid-cols-[1fr_260px]">
        <section className="min-h-[360px] rounded-xl border-4 border-zinc-500 bg-white p-4">
          <div className="text-xs uppercase text-zinc-500">{el.site_title} — {el.name}</div>
          {!open ? <p className="mt-16 text-center text-xl">Votação {el.status === "closed" ? "encerrada" : "pausada"}.</p>
          : fim ? <p className="mt-20 text-center text-7xl font-black tracking-widest" style={{ color }}>FIM</p>
          : already ? <p className="mt-16 text-center text-xl">Você já votou nesta eleição neste aparelho. Obrigado!</p>
          : !cur ? <p>Sem cargos cadastrados.</p> : (<>
            <h2 className="mt-2 text-xl font-bold">{cur.name}</h2>
            <div className="mt-3 flex gap-2">
              {blank ? <span className="text-3xl font-bold">VOTO EM BRANCO</span> :
                Array.from({ length: cur.digits }).map((_, n) => (
                  <span key={n} className="flex h-14 w-11 items-center justify-center rounded border-2 text-3xl font-bold" style={{ borderColor: color }}>{digits[n] ?? ""}</span>))}
            </div>
            {cand && (
              <div className="mt-4 flex gap-4">
                {cand.photo_url && <img src={cand.photo_url} alt="" className="h-36 w-28 rounded object-cover" />}
                <div className="min-w-0 break-words text-sm">
                  <div className="text-lg font-bold">{cand.ballot_name}</div>
                  {cand.full_name && <div>{cand.full_name}</div>}
                  <div>Partido: {cand.party}</div>
                  {cand.vice && <div>Vice: {cand.vice}</div>}
                  {cand.description && <div className="text-zinc-500">{cand.description}</div>}
                </div>
              </div>)}
            {full && !cand && <p className="mt-4 font-bold">{el.null_allowed ? "NÚMERO ERRADO — VOTO NULO" : "NÚMERO INEXISTENTE"}</p>}
            {err && <p className="mt-3 text-sm text-red-600">{err} (confirme novamente para tentar de novo)</p>}
            <p className="mt-6 border-t pt-2 text-xs text-zinc-500">CONFIRMA para confirmar · CORRIGE para refazer · ({i + 1}/{pos.length})</p>
          </>)}
        </section>
        <section className="grid content-start gap-2">
          <div className="grid grid-cols-3 gap-2">{["1","2","3","4","5","6","7","8","9"].map(k => <Key key={k} k={k} />)}<div /><Key k="0" /><div /></div>
          <div className="grid grid-cols-3 gap-2 text-xs font-bold">
            <button disabled={!el.blank_allowed || !open || already} onClick={() => { somTecla(); setDigits(""); setBlank(true); }} className="h-14 rounded-lg border bg-white disabled:opacity-40">BRANCO</button>
            <button onClick={() => { somTecla(); corrige(); }} className="h-14 rounded-lg bg-orange-500 text-white">CORRIGE</button>
            <button onClick={confirma} disabled={busy || already || !(blank || full)} className="h-14 rounded-lg bg-green-600 text-white disabled:opacity-40">CONFIRMA</button>
          </div>
        </section>
      </div>
    </main>);
}
