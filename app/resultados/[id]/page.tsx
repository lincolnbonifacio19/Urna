"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function Resultados() {
  const { id } = useParams<{ id: string }>();
  const [el, setEl] = useState<any>(null);
  const [pos, setPos] = useState<any[]>([]);
  const [cands, setCands] = useState<any[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [err, setErr] = useState("");
  const [at, setAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_results", { p_election: id });
    if (error) return setErr(error.message);
    setErr(""); setRows(data ?? []); setAt(new Date());
  }, [id]);

  useEffect(() => { (async () => {
    const { data: e } = await supabase.from("elections").select("*").eq("id", id).single();
    const { data: p } = await supabase.from("positions").select("*").eq("election_id", id).order("sort");
    const { data: c } = await supabase.from("candidates").select("*").in("position_id", (p ?? []).map(x => x.id));
    setEl(e); setPos(p ?? []); setCands(c ?? []); load();
  })();
  const ch = supabase.channel("v" + id).on("postgres_changes",
    { event: "INSERT", schema: "public", table: "vote_events", filter: `election_id=eq.${id}` }, load).subscribe();
  return () => { supabase.removeChannel(ch); }; }, [id, load]);

  const tally = (pid: string) => {
    const r = rows.filter(x => x.position_id === pid);
    const n = (k: string) => Number(r.filter(x => x.kind === k).reduce((s, x) => s + Number(x.total), 0));
    const list = cands.filter(c => c.position_id === pid)
      .map(c => ({ ...c, votes: Number(r.find(x => x.candidate_id === c.id)?.total ?? 0) }))
      .sort((a, b) => b.votes - a.votes);
    const valid = list.reduce((s, c) => s + c.votes, 0);
    return { list, valid, blank: n("blank"), nul: n("null"), total: valid + n("blank") + n("null") };
  };
  const csv = () => {
    const out = ["cargo,numero,candidato,votos,percentual_validos"];
    pos.forEach(p => { const t = tally(p.id);
      t.list.forEach(c => out.push(`"${p.name}",${c.number},"${c.ballot_name}",${c.votes},${t.valid ? (100 * c.votes / t.valid).toFixed(2) : 0}`));
      out.push(`"${p.name}",,Branco,${t.blank},`, `"${p.name}",,Nulo,${t.nul},`); });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([out.join("\n")], { type: "text/csv" }));
    a.download = "resultados.csv"; a.click();
  };

  if (err) return <p className="p-6">{err}</p>;
  if (!el) return <p className="p-6">Carregando…</p>;
  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">{el.name}</h1>
        <span className={`rounded px-2 py-1 text-xs text-white ${el.status === "open" ? "bg-green-600" : "bg-zinc-600"}`}>
          {el.status === "open" ? "Em andamento" : el.status === "closed" ? "Encerrada" : "Pausada"}</span>
      </div>
      <p className="text-xs text-zinc-500">Atualizado às {at?.toLocaleTimeString()}</p>
      <div className="my-3 flex gap-2 print:hidden">
        <button onClick={csv} className="rounded border px-3 py-1">Exportar CSV</button>
        <button onClick={() => window.print()} className="rounded border px-3 py-1">Imprimir</button>
      </div>
      {pos.map(p => { const t = tally(p.id); return (
        <section key={p.id} className="mb-6 rounded-xl border p-4">
          <h2 className="font-semibold">{p.name} — {t.total} votos (válidos: {t.valid})</h2>
          {t.list.map((c, n) => { const pc = t.valid ? 100 * c.votes / t.valid : 0; return (
            <div key={c.id} className="mt-2 text-sm">
              <div className="flex justify-between"><span>{n + 1}º {c.ballot_name} ({c.number})</span><span>{c.votes} · {pc.toFixed(1)}%</span></div>
              <div className="h-3 rounded bg-zinc-200"><div className="h-3 rounded transition-all" style={{ width: `${pc}%`, background: el.primary_color }} /></div>
            </div>); })}
          <p className="mt-3 text-sm text-zinc-600">Brancos: {t.blank} · Nulos: {t.nul}</p>
        </section>); })}
    </main>);
}
