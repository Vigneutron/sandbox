"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/store";
import { GoalStructure, TemplateBundle } from "@/lib/types";
import { getSupabase } from "@/lib/supabase";

interface TemplateRow {
  id: string;
  title: string;
  structure: GoalStructure;
  official: boolean;
  pro: boolean;
  category: string;
  description: string;
  times_used: number;
  body: TemplateBundle | null;
}

const STRUCTURE_ICON: Record<GoalStructure, string> = {
  linear: "→",
  pyramid: "△",
  tree: "⑂",
  habit: "↻",
  machine: "⚙",
};

function bundleSummary(t: TemplateRow): string {
  if (!t.body) return `${STRUCTURE_ICON[t.structure]} ${t.structure}`;
  const parts = t.body.goals.map((g) => STRUCTURE_ICON[g.structure] ?? "→");
  const nodes = t.body.goals.reduce((n, g) => n + (g.nodes?.length ?? 0), 0);
  const label =
    t.body.goals.length > 1
      ? `${parts.join(" + ")} · ${t.body.goals.length} goals`
      : `${parts[0]} ${t.body.goals[0].structure}`;
  return nodes > 0 ? `${label} · ${nodes} steps` : label;
}

export default function LibraryPage() {
  const { state, ready, cloudEnabled, importBundle } = useApp();
  const router = useRouter();
  const [templates, setTemplates] = useState<TemplateRow[] | null>(null);
  const [category, setCategory] = useState<string>("All");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    sb.from("goal_templates")
      .select("id,title,structure,official,pro,category,description,times_used,body")
      .order("official", { ascending: false })
      .order("times_used", { ascending: false })
      .then(({ data, error }) => {
        if (error) setMessage(error.message);
        else setTemplates((data as TemplateRow[]) ?? []);
      });
  }, []);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const t of templates ?? []) set.add(t.category);
    return ["All", ...[...set].sort()];
  }, [templates]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (templates ?? []).filter(
      (t) =>
        (category === "All" || t.category === category) &&
        (!q ||
          t.title.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q))
    );
  }, [templates, category, search]);

  if (!ready) return null;

  if (!cloudEnabled) {
    return (
      <div className="py-16 text-center">
        <h1 className="text-2xl font-bold">Library coming soon</h1>
        <p className="mx-auto mt-3 max-w-md text-gray-300">
          The goal library needs cloud sync, which isn&apos;t configured on
          this deployment yet.
        </p>
      </div>
    );
  }

  const copyTemplate = async (t: TemplateRow) => {
    if (t.pro && !state.pro) {
      setMessage("👑 That's a Pro template — go Pro to use it.");
      return;
    }
    const sb = getSupabase();
    if (!sb) return;
    setBusyId(t.id);
    setMessage(null);

    let bundle: TemplateBundle | null = t.body;
    if (!bundle) {
      // legacy template stored in template_milestones
      const { data, error } = await sb
        .from("template_milestones")
        .select("id,parent_id,title,position")
        .eq("template_id", t.id)
        .order("position");
      if (error) {
        setMessage(error.message);
        setBusyId(null);
        return;
      }
      bundle = {
        goals: [
          {
            key: "g1",
            title: t.title,
            structure: t.structure,
            nodes: (data ?? []).map((r) => ({
              key: r.id,
              parent: r.parent_id ?? null,
              title: r.title,
            })),
          },
        ],
      };
    }

    const result = importBundle(bundle);
    if (result.error) {
      setMessage(result.error);
      setBusyId(null);
      return;
    }
    sb.rpc("increment_template_uses", { tid: t.id }).then(() => {});
    router.push(`/goal/${result.goalId}`);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold">Goal Library</h1>
      <p className="mt-2 text-gray-300">
        Proven structures — copy one and it becomes your own goals, fresh and
        uncompleted. Some templates build several connected goals at once.
      </p>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search goals… (e.g. marathon, debt, guitar)"
        className="mt-4 w-full rounded-lg border border-gray-600 bg-navy-900 px-3 py-2 outline-none focus:border-gold-500"
      />
      <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
              category === c
                ? "bg-gold-500 text-ongold"
                : "bg-navy-700 text-gray-300"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {message && (
        <p className="mt-4 rounded-md bg-navy-800 px-3 py-2 text-sm text-gold-300">
          {message}{" "}
          {message.includes("Pro") && (
            <Link href="/upgrade" className="underline">
              Upgrade
            </Link>
          )}
        </p>
      )}

      {templates === null ? (
        <p className="mt-6 text-gray-400">Loading the library…</p>
      ) : visible.length === 0 ? (
        <p className="mt-6 text-gray-400">
          No templates match. Try another search — or open one of your goals
          and tap “Share to library” to publish your own.
        </p>
      ) : (
        <div className="mt-5 space-y-3">
          {visible.map((t) => (
            <div
              key={t.id}
              className="rounded-lg border border-gray-700 bg-navy-900 p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-semibold">
                    {t.official && (
                      <span className="mr-1 text-gold-400" title="Official">
                        ★
                      </span>
                    )}
                    {t.title}
                    {t.pro && (
                      <span className="ml-1.5 text-sm" title="Pro template">
                        👑
                      </span>
                    )}
                  </h2>
                  <p className="text-sm text-gray-400">
                    {bundleSummary(t)}
                    {t.times_used > 0 && <> · used {t.times_used}×</>}
                  </p>
                </div>
                <button
                  onClick={() => copyTemplate(t)}
                  disabled={busyId !== null}
                  className="shrink-0 rounded-lg bg-gold-500 px-4 py-2 text-sm font-medium text-ongold hover:bg-gold-400 disabled:opacity-50"
                >
                  {busyId === t.id ? "Copying…" : "Use"}
                </button>
              </div>
              {t.description && (
                <p className="mt-1.5 text-sm text-gray-400">{t.description}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
