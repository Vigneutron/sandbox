"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/store";
import { GoalStructure } from "@/lib/types";
import { getSupabase } from "@/lib/supabase";

interface TemplateRow {
  id: string;
  title: string;
  structure: GoalStructure;
  official: boolean;
  times_used: number;
}

const STRUCTURE_ICON: Record<GoalStructure, string> = {
  linear: "→",
  pyramid: "△",
  tree: "⑂",
  habit: "↻",
  machine: "⚙",
};

export default function LibraryPage() {
  const { ready, cloudEnabled, importTemplate } = useApp();
  const router = useRouter();
  const [templates, setTemplates] = useState<TemplateRow[] | null>(null);
  const [nodeCounts, setNodeCounts] = useState<Record<string, number>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    sb.from("goal_templates")
      .select("id,title,structure,official,times_used")
      .order("official", { ascending: false })
      .order("times_used", { ascending: false })
      .then(({ data, error }) => {
        if (error) setMessage(error.message);
        else setTemplates((data as TemplateRow[]) ?? []);
      });
    sb.from("template_milestones")
      .select("template_id")
      .then(({ data }) => {
        if (!data) return;
        const counts: Record<string, number> = {};
        for (const row of data as { template_id: string }[]) {
          counts[row.template_id] = (counts[row.template_id] ?? 0) + 1;
        }
        setNodeCounts(counts);
      });
  }, []);

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

  const copyTemplate = async (template: TemplateRow) => {
    const sb = getSupabase();
    if (!sb) return;
    setBusyId(template.id);
    setMessage(null);
    const { data, error } = await sb
      .from("template_milestones")
      .select("id,parent_id,title,position")
      .eq("template_id", template.id)
      .order("position");
    if (error) {
      setMessage(error.message);
      setBusyId(null);
      return;
    }
    const result = importTemplate(
      template.title,
      template.structure,
      (data ?? []).map((r) => ({
        id: r.id,
        parentId: r.parent_id ?? null,
        title: r.title,
        position: r.position,
      }))
    );
    if (result.error) {
      setMessage(result.error);
      setBusyId(null);
      return;
    }
    sb.rpc("increment_template_uses", { tid: template.id }).then(() => {});
    router.push(`/goal/${result.goalId}`);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold">Goal Library</h1>
      <p className="mt-2 text-gray-300">
        Structures shared by other climbers. Use one as your starting map —
        it copies into your goals, fresh and uncompleted.
      </p>

      {message && (
        <p className="mt-4 rounded-md bg-navy-800 px-3 py-2 text-sm text-gold-300">
          {message}
        </p>
      )}

      {templates === null ? (
        <p className="mt-6 text-gray-400">Loading the library…</p>
      ) : templates.length === 0 ? (
        <p className="mt-6 text-gray-400">
          Nothing here yet. Open one of your goals and tap “Share to library”
          to publish the first template.
        </p>
      ) : (
        <div className="mt-6 space-y-3">
          {templates.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-gray-700 bg-navy-900 p-4"
            >
              <div className="min-w-0">
                <h2 className="font-semibold">
                  {t.official && (
                    <span className="mr-1 text-gold-400" title="Official template">
                      ★
                    </span>
                  )}
                  {t.title}
                </h2>
                <p className="text-sm text-gray-400">
                  {STRUCTURE_ICON[t.structure]} {t.structure} ·{" "}
                  {nodeCounts[t.id] ?? "…"} milestones
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
          ))}
        </div>
      )}
    </div>
  );
}
