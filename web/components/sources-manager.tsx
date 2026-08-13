"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Loader2,
  Play,
  Plus,
  Radio,
  Trash2,
  FlaskConical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  createSourceAction,
  deleteSourceAction,
  runSourceAction,
  testSourceAction,
  type SourcePublic,
} from "@/lib/actions/sources";

type Props = {
  initialSources: SourcePublic[];
};

export function SourcesManager({ initialSources }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [sourceType, setSourceType] = useState<
    "rss" | "api" | "imap" | "playwright" | "career_page" | "telegram"
  >("rss");
  const [name, setName] = useState("");
  const [feedUrl, setFeedUrl] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [imapServer, setImapServer] = useState("");
  const [imapUsername, setImapUsername] = useState("");
  const [imapPassword, setImapPassword] = useState("");
  const [startUrl, setStartUrl] = useState("");
  const [jobListPath, setJobListPath] = useState("/careers");
  const [jobCardSelector, setJobCardSelector] = useState(".job-card");
  const [titleSelector, setTitleSelector] = useState(".job-title a");
  const [urlSelector, setUrlSelector] = useState("");
  const [botToken, setBotToken] = useState("");
  const [channelId, setChannelId] = useState("");
  const [messageFilter, setMessageFilter] = useState("");

  function refresh() {
    router.refresh();
  }

  function onCreate(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await createSourceAction({
        sourceType,
        name,
        feedUrl: sourceType === "rss" ? feedUrl : undefined,
        baseUrl:
          sourceType === "api" || sourceType === "career_page"
            ? baseUrl
            : undefined,
        imapServer: sourceType === "imap" ? imapServer : undefined,
        imapUsername: sourceType === "imap" ? imapUsername : undefined,
        imapPassword: sourceType === "imap" ? imapPassword : undefined,
        startUrl: sourceType === "playwright" ? startUrl : undefined,
        jobListPath: sourceType === "career_page" ? jobListPath : undefined,
        jobCardSelector:
          sourceType === "playwright" || sourceType === "career_page"
            ? jobCardSelector
            : undefined,
        titleSelector:
          sourceType === "playwright" || sourceType === "career_page"
            ? titleSelector
            : undefined,
        urlSelector:
          sourceType === "playwright" || sourceType === "career_page"
            ? urlSelector || undefined
            : undefined,
        botToken: sourceType === "telegram" ? botToken : undefined,
        channelId: sourceType === "telegram" ? channelId : undefined,
        messageFilter:
          sourceType === "telegram" ? messageFilter || undefined : undefined,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Source added");
      setShowForm(false);
      setName("");
      setFeedUrl("");
      setBaseUrl("");
      setImapPassword("");
      setBotToken("");
      refresh();
    });
  }

  function onRun(id: string) {
    startTransition(async () => {
      const result = await runSourceAction(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Collection queued");
      refresh();
    });
  }

  function onTest(id: string) {
    startTransition(async () => {
      const result = await testSourceAction(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Test passed");
    });
  }

  function onDelete(id: string) {
    startTransition(async () => {
      const result = await deleteSourceAction(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Source removed");
      refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          RSS, API, IMAP, Playwright, career pages, Telegram
        </p>
        <Button
          type="button"
          className="cursor-pointer"
          onClick={() => setShowForm((v) => !v)}
        >
          <Plus className="mr-2 h-4 w-4" aria-hidden />
          Add source
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>New source</CardTitle>
            <CardDescription>
              Configure a collector. Secrets are never shown again after save.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onCreate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="source-type">Type</Label>
                <select
                  id="source-type"
                  className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
                  value={sourceType}
                  onChange={(e) =>
                    setSourceType(
                      e.target.value as
                        | "rss"
                        | "api"
                        | "imap"
                        | "playwright"
                        | "career_page"
                        | "telegram",
                    )
                  }
                >
                  <option value="rss">RSS</option>
                  <option value="api">REST API</option>
                  <option value="imap">IMAP email</option>
                  <option value="career_page">Career page</option>
                  <option value="playwright">Playwright scraper</option>
                  <option value="telegram">Telegram channel</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="source-name">Name</Label>
                <Input
                  id="source-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="My job feed"
                />
              </div>
              {sourceType === "rss" && (
                <div className="space-y-2">
                  <Label htmlFor="feed-url">Feed URL</Label>
                  <Input
                    id="feed-url"
                    type="url"
                    value={feedUrl}
                    onChange={(e) => setFeedUrl(e.target.value)}
                    required
                    placeholder="https://example.com/jobs.rss"
                  />
                </div>
              )}
              {sourceType === "api" && (
                <div className="space-y-2">
                  <Label htmlFor="base-url">Base URL</Label>
                  <Input
                    id="base-url"
                    type="url"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    required
                    placeholder="https://api.example.com/jobs"
                  />
                </div>
              )}
              {sourceType === "imap" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="imap-server">IMAP server</Label>
                    <Input
                      id="imap-server"
                      value={imapServer}
                      onChange={(e) => setImapServer(e.target.value)}
                      required
                      placeholder="imap.gmail.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="imap-user">Username</Label>
                    <Input
                      id="imap-user"
                      value={imapUsername}
                      onChange={(e) => setImapUsername(e.target.value)}
                      required
                      autoComplete="username"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="imap-pass">Password</Label>
                    <Input
                      id="imap-pass"
                      type="password"
                      value={imapPassword}
                      onChange={(e) => setImapPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                    />
                  </div>
                </>
              )}
              {sourceType === "playwright" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="start-url">Start URL</Label>
                    <Input
                      id="start-url"
                      type="url"
                      value={startUrl}
                      onChange={(e) => setStartUrl(e.target.value)}
                      required
                      placeholder="https://company.com/careers"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="card-sel">Job card selector</Label>
                    <Input
                      id="card-sel"
                      value={jobCardSelector}
                      onChange={(e) => setJobCardSelector(e.target.value)}
                      required
                      placeholder=".job-card"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="title-sel">Title selector</Label>
                    <Input
                      id="title-sel"
                      value={titleSelector}
                      onChange={(e) => setTitleSelector(e.target.value)}
                      required
                      placeholder=".job-title a"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="url-sel">URL selector (optional)</Label>
                    <Input
                      id="url-sel"
                      value={urlSelector}
                      onChange={(e) => setUrlSelector(e.target.value)}
                      placeholder=".job-title a"
                    />
                  </div>
                </>
              )}
              {sourceType === "career_page" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="career-base">Base URL</Label>
                    <Input
                      id="career-base"
                      type="url"
                      value={baseUrl}
                      onChange={(e) => setBaseUrl(e.target.value)}
                      required
                      placeholder="https://company.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="list-path">Job list path</Label>
                    <Input
                      id="list-path"
                      value={jobListPath}
                      onChange={(e) => setJobListPath(e.target.value)}
                      required
                      placeholder="/careers"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="career-card">Job card selector</Label>
                    <Input
                      id="career-card"
                      value={jobCardSelector}
                      onChange={(e) => setJobCardSelector(e.target.value)}
                      required
                      placeholder=".job-card"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="career-title">Title selector</Label>
                    <Input
                      id="career-title"
                      value={titleSelector}
                      onChange={(e) => setTitleSelector(e.target.value)}
                      required
                      placeholder=".job-title a"
                    />
                  </div>
                </>
              )}
              {sourceType === "telegram" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="bot-token">Bot token</Label>
                    <Input
                      id="bot-token"
                      type="password"
                      value={botToken}
                      onChange={(e) => setBotToken(e.target.value)}
                      required
                      autoComplete="off"
                      placeholder="123456:ABC..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="channel-id">Channel ID</Label>
                    <Input
                      id="channel-id"
                      value={channelId}
                      onChange={(e) => setChannelId(e.target.value)}
                      required
                      placeholder="@jobs_channel or -100..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="msg-filter">Message filter (regex)</Label>
                    <Input
                      id="msg-filter"
                      value={messageFilter}
                      onChange={(e) => setMessageFilter(e.target.value)}
                      placeholder="hiring|engineer|remote"
                    />
                  </div>
                </>
              )}
              <Button
                type="submit"
                className="cursor-pointer"
                disabled={isPending}
              >
                {isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                )}
                Save source
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {initialSources.length === 0 && !showForm ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Radio className="h-8 w-8" aria-hidden />
          </div>
          <h3 className="mb-2 text-lg font-semibold tracking-tight">
            No sources connected
          </h3>
          <p className="mb-6 max-w-xs text-sm text-muted-foreground">
            Add an RSS feed, API, IMAP mailbox, or career-page scraper to start
            collecting jobs.
          </p>
          <Button
            type="button"
            className="cursor-pointer"
            onClick={() => setShowForm(true)}
          >
            <Plus className="mr-2 h-4 w-4" aria-hidden />
            Add source
          </Button>
        </div>
      ) : (
        <ul className="space-y-3" aria-label="Your sources">
          {initialSources.map((s) => (
            <li key={s.id}>
              <Card>
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-medium">{s.name}</h3>
                      <Badge variant="secondary">{s.sourceType}</Badge>
                      {s.lastRunStatus && (
                        <Badge variant="outline">{s.lastRunStatus}</Badge>
                      )}
                      {!s.isActive && (
                        <Badge variant="outline">inactive</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {s.sourceType === "rss" &&
                        String(s.config.feedUrl ?? "")}
                      {s.sourceType === "api" &&
                        String(s.config.baseUrl ?? "")}
                      {s.sourceType === "imap" &&
                        String(s.config.imapServer ?? "")}
                      {s.sourceType === "playwright" &&
                        String(s.config.startUrl ?? "")}
                      {s.sourceType === "career_page" &&
                        String(s.config.baseUrl ?? "")}
                      {s.sourceType === "telegram" &&
                        String(s.config.channelId ?? "")}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="cursor-pointer"
                      disabled={isPending}
                      onClick={() => onTest(s.id)}
                    >
                      <FlaskConical className="mr-1 h-4 w-4" aria-hidden />
                      Test
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="cursor-pointer"
                      disabled={isPending || !s.isActive}
                      onClick={() => onRun(s.id)}
                    >
                      <Play className="mr-1 h-4 w-4" aria-hidden />
                      Run now
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="cursor-pointer"
                      disabled={isPending}
                      onClick={() => onDelete(s.id)}
                      aria-label={`Delete ${s.name}`}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
