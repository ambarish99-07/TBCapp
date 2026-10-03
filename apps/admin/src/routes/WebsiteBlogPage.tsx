import { useEffect, useState } from "react";
import { adminClient } from "../api/adminClient.js";
import { Badge } from "../components/ui/Badge.js";
import { Button } from "../components/ui/Button.js";
import { Card } from "../components/ui/Card.js";
import { EmptyState } from "../components/ui/EmptyState.js";
import { Input } from "../components/ui/Input.js";
import { PageHeader } from "../components/ui/PageHeader.js";

/** A website blog post as the admin-peer link returns it (the website owns the blog). */
interface BlogPost {
  id: string;
  title: string;
  excerpt: string;
  body: string;
  coverImageUrl: string | null;
  tags: string[];
  status: "draft" | "published";
  publishedAt: string | null;
}

type Draft = {
  id?: string;
  title: string;
  excerpt: string;
  body: string;
  coverImageUrl: string;
  tags: string;
  status: "draft" | "published";
};

const BLANK: Draft = {
  title: "",
  excerpt: "",
  body: "",
  coverImageUrl: "",
  tags: "",
  status: "draft",
};

const LABEL = "mb-1 block text-xs font-bold uppercase tracking-wide text-muted";

/** The website's blog, written from the Lickyeat Admin (the app has no blog). */
export function WebsiteBlogPage() {
  const [posts, setPosts] = useState<BlogPost[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  async function reload() {
    setLoadError(null);
    try {
      const res = await adminClient.get<{ posts: BlogPost[] }>(
        "/admin/website/blog",
      );
      setPosts(res.data.posts);
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : "Couldn't load the blog",
      );
    }
  }

  useEffect(() => {
    reload();
  }, []);

  function edit(p: BlogPost) {
    setDraft({
      id: p.id,
      title: p.title,
      excerpt: p.excerpt,
      body: p.body,
      coverImageUrl: p.coverImageUrl ?? "",
      tags: p.tags.join(", "),
      status: p.status,
    });
  }

  async function save() {
    if (!draft) return;
    const payload = {
      title: draft.title,
      excerpt: draft.excerpt,
      body: draft.body,
      coverImageUrl: draft.coverImageUrl || null,
      tags: draft.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      status: draft.status,
    };
    setSaving(true);
    try {
      if (draft.id)
        await adminClient.patch(`/admin/website/blog/${draft.id}`, payload);
      else await adminClient.post("/admin/website/blog", payload);
      setDraft(null);
      await reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Couldn't save the post");
    } finally {
      setSaving(false);
    }
  }

  async function remove(p: BlogPost) {
    if (!confirm(`Delete "${p.title}" from the website? This can't be undone.`))
      return;
    try {
      await adminClient.delete(`/admin/website/blog/${p.id}`);
      await reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Couldn't delete the post");
    }
  }

  return (
    <div>
      <PageHeader
        title="Blog"
        description="Posts on the website's blog. The app doesn't show the blog."
        action={
          !draft && (
            <Button onClick={() => setDraft({ ...BLANK })}>New post</Button>
          )
        }
      />

      {draft ? (
        <Card title={draft.id ? `Edit "${draft.id}"` : "New post"}>
          <div className="space-y-3">
            <label className="block">
              <span className={LABEL}>Title</span>
              <Input
                className="w-full"
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
            </label>
            <label className="block">
              <span className={LABEL}>Excerpt</span>
              <Input
                className="w-full"
                value={draft.excerpt}
                onChange={(e) =>
                  setDraft({ ...draft, excerpt: e.target.value })
                }
              />
            </label>
            <label className="block">
              <span className={LABEL}>
                Cover image URL (full URL, or a website path like
                /static/menu-images/choco-crush.jpg)
              </span>
              <Input
                className="w-full"
                value={draft.coverImageUrl}
                onChange={(e) =>
                  setDraft({ ...draft, coverImageUrl: e.target.value })
                }
              />
            </label>
            <label className="block">
              <span className={LABEL}>Tags (comma separated)</span>
              <Input
                className="w-full"
                value={draft.tags}
                onChange={(e) => setDraft({ ...draft, tags: e.target.value })}
              />
            </label>
            <label className="block">
              <span className={LABEL}>
                Body — ## heading, - list, blank line = new paragraph, **bold**
              </span>
              <textarea
                className="min-h-[240px] w-full rounded-lg border border-border bg-white px-3 py-2 font-mono text-xs text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                value={draft.body}
                onChange={(e) => setDraft({ ...draft, body: e.target.value })}
              />
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold text-text">
              <input
                type="checkbox"
                checked={draft.status === "published"}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    status: e.target.checked ? "published" : "draft",
                  })
                }
                className="h-4 w-4 accent-primary"
              />
              Published (visible on the website)
            </label>
            <div className="flex gap-2">
              <Button onClick={save} disabled={!draft.title || saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
              <Button variant="secondary" onClick={() => setDraft(null)}>
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <Card>
          {loadError ? (
            <p className="text-sm font-medium text-danger">{loadError}</p>
          ) : posts === null ? (
            <p className="text-sm text-muted">Loading…</p>
          ) : posts.length === 0 ? (
            <EmptyState message="No posts yet — write the first one." />
          ) : (
            <div className="divide-y divide-border">
              {posts.map((p) => (
                <div
                  key={p.id}
                  className="flex flex-wrap items-center gap-3 py-3"
                >
                  <div className="min-w-[200px]">
                    <p className="font-semibold text-text">{p.title}</p>
                    <p className="text-xs text-muted">
                      /blog/{p.id} ·{" "}
                      {p.publishedAt
                        ? new Date(p.publishedAt).toLocaleDateString()
                        : "not published"}
                    </p>
                  </div>
                  <Badge
                    tone={p.status === "published" ? "success" : "neutral"}
                  >
                    {p.status}
                  </Badge>
                  <div className="ml-auto flex gap-2">
                    <Button variant="secondary" onClick={() => edit(p)}>
                      Edit
                    </Button>
                    <Button variant="danger" onClick={() => remove(p)}>
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
