"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
export default function Home() {
  const [els, setEls] = useState<any[]>([]);
  useEffect(() => { supabase.from("elections").select("*").order("created_at", { ascending: false }).then(r => setEls(r.data ?? [])); }, []);
  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-3xl font-bold mb-1">Urna Virtual</h1>
      <p className="text-sm text-slate-500 mb-6">Ferramenta de votação simulada/privada — não é urna oficial nem certificada.</p>
      {els.map(e => (
        <div key={e.id} className="mb-3 rounded-xl border p-4">
          <div className="font-semibold">{e.name} <span className="text-xs text-slate-500">({e.status})</span></div>
          <p className="text-sm text-slate-600">{e.description}</p>
          <div className="mt-3 flex gap-2">
            <a className="rounded bg-slate-900 px-4 py-2 text-white" href={`/urna/${e.id}`}>Votar</a>
            {e.results_public && <a className="rounded border px-4 py-2" href={`/resultados/${e.id}`}>Resultados</a>}
          </div>
        </div>))}
      <a className="text-sm underline" href="/admin">Administração</a>
    </main>);
}
