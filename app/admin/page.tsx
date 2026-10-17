"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const inp = "rounded border p-2 text-sm";
export default function Admin() {
  const [ok, setOk] = useState<boolean | null>(null);
  const [cred, setCred] = useState({ email: "", password: "" });
  const [els, setEls] = useState<any[]>([]);
  const [sel, setSel] = useState<any>(null);
  const [pos, setPos] = useState<any[]>([]);
  const [cands, setCands] = useState<any[]>([]);
  const [msg, setMsg] = useState("");
  const [np, setNp] = useState({ name: "", digits: 2 });
  const [nc, setNc] = useState<any>({ position_id: "", number: "", ballot_name: "", full_name: "", party: "", vice: "", description: "" });
  const [file, setFile] = useState<File | null>(null);

  const check = async () => { const { data } = await supabase.rpc("is_admin"); setOk(!!data); if (data) loadEls(); };
  const loadEls = async () => { const { data } = await supabase.from("elections").select("*").order("created_at", { ascending: false }); setEls(data ?? []); };
  const loadSel = async (e: any) => {
    setSel(e);
    const { data: p } = await supabase.from("positions").select("*").eq("election_id", e.id).order("sort");
    const { data: c } = await supabase.from("candidates").select("*").in("position_id", (p ?? []).map(x => x.id)).order("sort");
    setPos(p ?? []); setCands(c ?? []);
  };
  useEffect(() => { check(); }, []);
  const run = async (q: any, okMsg = "Salvo.") => { const { error } = await q; setMsg(error ? error.message : okMsg); return !error; };
  const upd = async (patch: any) => { if (await run(supabase.from("elections").update(patch).eq("id", sel.id))) { setSel({ ...sel, ...patch }); loadEls(); } };

  const login = async () => { const { error } = await supabase.auth.signInWithPassword(cred); if (error) setMsg(error.message); else check(); };
  if (ok === null) return <p className="p-6">Carregando…</p>;
  if (!ok) return (
    <main className="mx-auto grid max-w-sm gap-2 p-6">
      <h1 className="text-xl font-bold">Admin</h1>
      <input className={inp} placeholder="e-mail" onChange={e => setCred({ ...cred, email: e.target.value })} />
      <input className={inp} type="password" placeholder="senha" onChange={e => setCred({ ...cred, password: e.target.value })} />
      <button className="rounded bg-slate-900 p-2 text-white" onClick={login}>Entrar</button>
      <p className="text-sm text-red-600">{msg}</p>
    </main>);

  const addCand = async () => {
    let photo_url = null;
    if (file) {
      const path = `${crypto.randomUUID()}-${file.name}`;
      const up = await supabase.storage.from("fotos").upload(path, file);
      if (up.error) return setMsg(up.error.message);
      photo_url = supabase.storage.from("fotos").getPublicUrl(path).data.publicUrl;
    }
    if (await run(supabase.from("candidates").insert({ ...nc, photo_url }))) { setFile(null); loadSel(sel); }
  };
  const importCsv = async (f: File) => {
    const lines = (await f.text()).split(/\r?\n/).slice(1).filter(Boolean);
    const rows = lines.map(l => l.split(",")).map(c => ({ position_id: pos.find(p => p.name === c[0])?.id, number: c[1], ballot_name: c[2], full_name: c[3], party: c[4] })).filter(r => r.position_id);
    if (await run(supabase.from("candidates").insert(rows), `${rows.length} importados.`)) loadSel(sel);
  };
  const exportCsv = () => {
    const t = ["cargo,numero,nome_urna,nome_completo,partido", ...cands.map(c => `${pos.find(p => p.id === c.position_id)?.name},${c.number},${c.ballot_name},${c.full_name},${c.party}`)].join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([t], { type: "text/csv" })); a.download = "candidatos.csv"; a.click();
  };

  return (
    <main className="mx-auto max-w-4xl p-6">
      <div className="mb-4 flex items-center justify-between"><h1 className="text-2xl font-bold">Painel administrativo</h1>
        <button className="text-sm underline" onClick={async () => { await supabase.auth.signOut(); setOk(false); }}>Sair</button></div>
      {msg && <p className="mb-3 rounded bg-amber-100 p-2 text-sm">{msg}</p>}
      <div className="mb-4 flex flex-wrap gap-2">
        {els.map(e => <button key={e.id} onClick={() => loadSel(e)} className={`rounded border px-3 py-1 ${sel?.id === e.id ? "bg-slate-900 text-white" : ""}`}>{e.name}</button>)}
        <button className="rounded border border-dashed px-3 py-1" onClick={async () => { const n = prompt("Nome da eleição"); if (n && await run(supabase.from("elections").insert({ name: n }))) loadEls(); }}>+ Nova eleição</button>
      </div>
      {sel && <>
        <section className="mb-6 grid gap-2 rounded-xl border p-4 md:grid-cols-2">
          <input className={inp} defaultValue={sel.name} onBlur={e => upd({ name: e.target.value })} />
          <input className={inp} defaultValue={sel.description} placeholder="descrição" onBlur={e => upd({ description: e.target.value })} />
          <input className={inp} defaultValue={sel.site_title} placeholder="título do site" onBlur={e => upd({ site_title: e.target.value })} />
          <label className="text-sm">Cor <input type="color" value={sel.primary_color} onChange={e => upd({ primary_color: e.target.value })} /></label>
          <label className="text-sm">Início <input type="datetime-local" className={inp} onChange={e => upd({ starts_at: e.target.value || null })} /></label>
          <label className="text-sm">Fim <input type="datetime-local" className={inp} onChange={e => upd({ ends_at: e.target.value || null })} /></label>
          <select className={inp} value={sel.status} onChange={e => upd({ status: e.target.value })}>
            <option value="open">Aberta</option><option value="paused">Pausada</option><option value="closed">Encerrada</option></select>
          <label className="text-sm"><input type="checkbox" checked={sel.results_public} onChange={e => upd({ results_public: e.target.checked })} /> Resultados públicos</label>
          <label className="text-sm"><input type="checkbox" checked={sel.blank_allowed} onChange={e => upd({ blank_allowed: e.target.checked })} /> Permitir branco</label>
          <label className="text-sm"><input type="checkbox" checked={sel.null_allowed} onChange={e => upd({ null_allowed: e.target.checked })} /> Número inexistente vira nulo</label>
          <div className="flex gap-2 md:col-span-2">
            <a className="rounded border px-3 py-1 text-sm" href={`/resultados/${sel.id}`}>Resultados</a>
            <button className="rounded border px-3 py-1 text-sm" onClick={async () => {
              if (prompt('Digite APAGAR para zerar os votos') === "APAGAR") run(supabase.rpc("reset_election", { p_election: sel.id }), "Votos apagados."); }}>Reiniciar votos</button>
            <button className="rounded border border-red-400 px-3 py-1 text-sm text-red-600" onClick={async () => {
              if (confirm("Excluir eleição e tudo nela?") && await run(supabase.from("elections").delete().eq("id", sel.id))) { setSel(null); loadEls(); } }}>Excluir</button>
          </div>
        </section>
        <section className="mb-6 rounded-xl border p-4">
          <h2 className="mb-2 font-semibold">Cargos</h2>
          {pos.map(p => <div key={p.id} className="flex items-center gap-2 text-sm">{p.name} ({p.digits} dígitos)
            <button className="text-red-600" onClick={async () => { if (await run(supabase.from("positions").delete().eq("id", p.id))) loadSel(sel); }}>excluir</button></div>)}
          <div className="mt-2 flex gap-2">
            <input className={inp} placeholder="Cargo" value={np.name} onChange={e => setNp({ ...np, name: e.target.value })} />
            <input className={`${inp} w-20`} type="number" min={1} max={6} value={np.digits} onChange={e => setNp({ ...np, digits: +e.target.value })} />
            <button className="rounded bg-slate-900 px-3 text-white" onClick={async () => { if (await run(supabase.from("positions").insert({ ...np, election_id: sel.id, sort: pos.length }))) { setNp({ name: "", digits: 2 }); loadSel(sel); } }}>Adicionar</button>
          </div>
        </section>
        <section className="rounded-xl border p-4">
          <h2 className="mb-2 font-semibold">Candidatos</h2>
          {cands.map(c => <div key={c.id} className="flex items-center gap-2 border-b py-1 text-sm">
            {c.photo_url && <img src={c.photo_url} className="h-8 w-8 rounded object-cover" alt="" />}
            <b>{c.number}</b> {c.ballot_name} — {c.party} <i className="text-zinc-500">({pos.find(p => p.id === c.position_id)?.name})</i>
            <button className="ml-auto text-red-600" onClick={async () => { if (await run(supabase.from("candidates").delete().eq("id", c.id))) loadSel(sel); }}>excluir</button></div>)}
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            <select className={inp} value={nc.position_id} onChange={e => setNc({ ...nc, position_id: e.target.value })}><option value="">Cargo…</option>{pos.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
            {["number", "ballot_name", "full_name", "party", "vice", "description"].map(k => <input key={k} className={inp} placeholder={k} value={nc[k]} onChange={e => setNc({ ...nc, [k]: e.target.value })} />)}
            <input type="file" accept="image/*" onChange={e => setFile(e.target.files?.[0] ?? null)} />
            <button className="rounded bg-slate-900 p-2 text-white" onClick={addCand}>Cadastrar candidato</button>
          </div>
          <div className="mt-3 flex gap-2 text-sm"><button className="underline" onClick={exportCsv}>Exportar CSV</button>
            <label className="underline">Importar CSV<input type="file" accept=".csv" hidden onChange={e => e.target.files?.[0] && importCsv(e.target.files[0])} /></label></div>
        </section>
      </>}
    </main>);
            }
