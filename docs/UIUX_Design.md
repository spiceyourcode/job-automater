# UI/UX Design Document
## AI-Powered Job Application Automation Platform

---

## 1. Design Philosophy & Principles

### 1.1 Core Design Principles

| Principle | Description | Application |
|-----------|-------------|-------------|
| **Clarity over Cleverness** | Every element serves a clear purpose; no mystery meat navigation | Explicit labels, visible affordances, predictable interactions |
| **Progressive Disclosure** | Show only what's needed, when it's needed | Collapsible sections, contextual actions, staged onboarding |
| **Trust Through Transparency** | AI decisions must be explainable and controllable | Score breakdowns, reasoning display, manual override always available |
| **Efficiency First** | Minimize clicks for high-frequency actions | Keyboard shortcuts, bulk actions, smart defaults |
| **Calm Technology** | Reduce anxiety, not add to it | Subtle notifications, clear status, no dark patterns |

### 1.2 Brand Personality
- **Utilitarian** — Classic shadcn/ui: black, white, borders, no decorative chrome
- **Precise** — Data-driven, not hand-wavy
- **Empowering** — User remains in control; AI is a tool, not a black box
- **Calm** — Paper-like surfaces, generous whitespace, purposeful motion only

### 1.3 Visual Direction (locked)

| Decision | Choice | Do not |
|----------|--------|--------|
| Look | Default black & white **neutral** shadcn (`new-york`) | Custom colorful brand themes, purple/indigo SaaS gradients |
| Base color | `neutral` | `blue`, `violet`, `rose`, etc. as primary |
| Style | `new-york` | Heavy glassmorphism, neon, glow |
| Icons | Lucide SVG only | Emoji as UI icons |
| Radius | shadcn default (`--radius`) | Pill-everything (`rounded-full` on every control) |
| Light / dark | Light-first; dark via `class="dark"` | Dark-only marketing look |

---

## 2. Frontend Stack & Dev Workflow

### 2.1 Stack

| Layer | Choice |
|-------|--------|
| App | Next.js 15 App Router in `web/` |
| UI kit | [shadcn/ui](https://ui.shadcn.com) (copy-in components, not an npm UI package) |
| Primitives | Radix UI (via shadcn) |
| Styling | Tailwind CSS v4 + CSS variables from `components.json` |
| Icons | `lucide-react` |
| Forms | `react-hook-form` + Zod + shadcn `Form` / `Field` |
| Toasts | `sonner` via shadcn (`Toaster` in root layout only) |

### 2.2 shadcn MCP (agents & humans)

MCP is configured in [`.cursor/mcp.json`](../.cursor/mcp.json) as server `shadcn` (`npx shadcn@latest mcp`).

**Prerequisite:** `web/components.json` exists (created by `npx shadcn@latest init` during **P1.4**). Until then, pass registry `@shadcn` explicitly.

| MCP tool | When to use |
|----------|-------------|
| `get_project_registries` | Confirm `@shadcn` is wired |
| `search_items_in_registries` / `list_items_in_registries` | Find components before inventing UI |
| `view_items_in_registries` | Inspect item files / deps |
| `get_item_examples_from_registries` | Copy usage patterns (e.g. `button-demo`, `form-rhf-demo`) |
| `get_add_command_for_items` | Get exact `npx shadcn@latest add …` command |
| `get_audit_checklist` | After adding components / generating UI |

**Add components from `web/`:**

```bash
npx shadcn@latest add button card dialog badge input table sidebar sonner form skeleton
# or via MCP-resolved names:
npx shadcn@latest add @shadcn/button @shadcn/card @shadcn/dialog
```

**Agent rule:** Prefer registry components over one-off styled divs. Product composites (`JobCard`, `MatchScoreBadge`, pipeline columns) live in `web/components/` and compose shadcn primitives from `web/components/ui/`.

### 2.3 Init defaults (P1.4 — do not customize)

When scaffolding `web/`, run shadcn init with the **default vintage B&W** options:

```bash
cd web
npx shadcn@latest init
# Style: new-york
# Base color: neutral
# CSS variables: yes
# Accept default font (Geist) / path aliases
```

Keep `components.json` on these defaults. Do not switch base color to brand blues or add custom theme packages.

### 2.4 Implementation checklist (per UI task)

1. Read this doc + phase contract.
2. Search MCP / registry for an existing component before building.
3. Add via CLI; compose in `web/components/`.
4. Forms: `Form` + `zodResolver` + `FormMessage` (never placeholder-as-label).
5. Loading: `Skeleton` matching layout (not spinners for content regions).
6. App chrome: `SidebarProvider` at layout level when using Sidebar.
7. Root layout includes `<Toaster />` once.
8. Run MCP `get_audit_checklist`; verify focus rings, contrast, `cursor-pointer`, `prefers-reduced-motion`.

---

## 3. Visual Design System

### 3.1 Color Palette (shadcn neutral)

Tokens are the stock shadcn CSS variables (oklch). Primary actions are near-black on white — not a blue brand scale.

```css
:root {
  /* Surfaces — light (default) */
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.145 0 0);

  /* Actions — monochrome */
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.577 0.245 27.325);

  /* Chrome */
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
  --radius: 0.625rem;
}

.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  --card: oklch(0.205 0 0);
  --card-foreground: oklch(0.985 0 0);
  --primary: oklch(0.922 0 0);
  --primary-foreground: oklch(0.205 0 0);
  --secondary: oklch(0.269 0 0);
  --secondary-foreground: oklch(0.985 0 0);
  --muted: oklch(0.269 0 0);
  --muted-foreground: oklch(0.708 0 0);
  --accent: oklch(0.269 0 0);
  --accent-foreground: oklch(0.985 0 0);
  --destructive: oklch(0.704 0.191 22.216);
  --border: oklch(1 0 0 / 10%);
  --input: oklch(1 0 0 / 15%);
  --ring: oklch(0.556 0 0);
}
```

Use Tailwind semantic classes: `bg-background`, `text-foreground`, `bg-primary`, `text-muted-foreground`, `border-border`, `ring-ring`. Do not introduce `--color-brand-*` blues.

#### Semantic status (sparingly — not chrome)

| Role | Use | Rendering |
|------|-----|-----------|
| Success | submitted, connected | `Badge` outline / left border; green only on status chips |
| Warning | pending approval, rate limit | amber status chip |
| Error | failed apply, validation | `destructive` / form errors |
| Info | informational toast | muted + icon, not cyan brand fills |

#### Score-based coding (hue + pattern — a11y)

Keep scores readable on a B&W chrome: prefer outline badges + left border, not full-card color washes.

```css
/* Match scores — border + muted fill; never rely on color alone */
.score-excellent { /* 90–100 */ border-left: 3px solid oklch(0.55 0.15 150); background: oklch(0.97 0.01 150); }
.score-good      { /* 70–89  */ border-left: 3px solid oklch(0.45 0 0); background: oklch(0.97 0 0); }
.score-fair      { /* 50–69  */ border-left: 3px solid oklch(0.75 0.12 75); background: oklch(0.98 0.01 75); }
.score-poor      { /* <50    */ border-left: 3px solid oklch(0.55 0.2 25); background: oklch(0.98 0.01 25); }
```

Also show the numeric score as text (e.g. `92%`) so color is never the only signal.

### 3.2 Typography

Use fonts shipped by shadcn init (Geist Sans + Geist Mono). Single family with weight hierarchy — Swiss / minimal.

```css
:root {
  --font-sans: var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif;
  --font-mono: var(--font-geist-mono), ui-monospace, monospace;
}
```

| Token | Size | Weight | Line Height | Use Case |
|-------|------|--------|-------------|----------|
| `--text-display` | 48px / 3rem | 700 | 1.1 | Hero metrics |
| `--text-h1` | 32px / 2rem | 700 | 1.2 | Page titles |
| `--text-h2` | 24px / 1.5rem | 600 | 1.3 | Section headers |
| `--text-h3` | 20px / 1.25rem | 600 | 1.4 | Card titles |
| `--text-body-lg` | 18px / 1.125rem | 400 | 1.6 | Lead paragraphs |
| `--text-body` | 16px / 1rem | 400 | 1.6 | Body text (min 16px on mobile) |
| `--text-body-sm` | 14px / 0.875rem | 400 | 1.5 | Secondary text |
| `--text-caption` | 12px / 0.75rem | 500 | 1.4 | Labels, badges |
| `--text-mono` | 14px / 0.875rem | 400 | 1.6 | Code, IDs, timestamps |

### 3.3 Spacing System

Prefer Tailwind spacing scale (`p-4`, `gap-6`, …). Equivalent tokens:

```css
:root {
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-6: 1.5rem;
  --space-8: 2rem;
  --space-10: 2.5rem;
  --space-12: 3rem;
  --space-16: 4rem;
}
```

### 3.4 Radius & elevation

```css
:root {
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
}
```

Prefer **borders** (`border-border`) over heavy shadows. Cards are flat/bordered — no multi-layer glow.

### 3.5 Motion & Animation

```css
:root {
  --duration-fast: 100ms;
  --duration-normal: 200ms;
  --duration-slow: 300ms;
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

Micro-interactions only (150–300ms). Prefer `opacity` / `transform`. No layout-shifting scale on hover.

---

## 4. Component Library

Primitives come from shadcn (`web/components/ui/*`). Map product needs → registry items before inventing APIs.

### 4.1 Core Components (shadcn)

#### Button
```tsx
// shadcn variants: default | destructive | outline | secondary | ghost | link
// sizes: default | sm | lg | icon
import { Button } from "@/components/ui/button"
import { PlusIcon } from "lucide-react"

<Button size="default">
  <PlusIcon />
  Apply Now
</Button>
<Button variant="outline">View</Button>
<Button variant="ghost" size="sm">Cancel</Button>
```

#### Input Fields
```tsx
// Use Form + FormField + FormLabel + FormControl + FormMessage
// Inputs: Input, Textarea, Select, Combobox, Checkbox, Switch
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

<div className="grid gap-2">
  <Label htmlFor="salary">Target Salary</Label>
  <Input id="salary" type="number" inputMode="numeric" placeholder="150000" />
  <p className="text-sm text-muted-foreground">Annual base salary in USD</p>
</div>
```

#### Card
```tsx
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

<Card className="cursor-pointer transition-colors hover:bg-muted/40">
  <CardHeader className="flex-row items-start justify-between gap-2">
    <CardTitle>Senior Backend Engineer</CardTitle>
    <Badge variant="outline" className="score-excellent">92% Match</Badge>
  </CardHeader>
  <CardContent>...</CardContent>
  <CardFooter className="gap-2">
    <Button variant="ghost" size="sm">View</Button>
    <Button size="sm">Apply</Button>
  </CardFooter>
</Card>
```

#### Badge
```tsx
// Prefer outline / secondary on B&W chrome; reserve fills for destructive/status
<Badge variant="outline" className="score-excellent">92% Match</Badge>
<Badge variant="secondary">Interviewing</Badge>
<Badge variant="outline">LinkedIn</Badge>
```

#### Table
```tsx
// Use shadcn Table; add sorting/filters in product code
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
```

#### Dialog
```tsx
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"

<Dialog open={isOpen} onOpenChange={setOpen}>
  <DialogContent className="sm:max-w-lg">
    <DialogHeader>
      <DialogTitle>Generate Documents</DialogTitle>
    </DialogHeader>
    <DocumentGenerator job={job} onComplete={handleComplete} />
  </DialogContent>
</Dialog>
```

#### Toast
```tsx
// Root layout: <Toaster /> once (sonner)
import { toast } from "sonner"

toast.success("Application submitted", {
  description: "Confirmation received",
  action: { label: "View", onClick: () => router.push("/applications/123") },
})
```

### 4.2 Composite Components

#### JobCard (Primary Dashboard Component)
```tsx
interface JobCardProps {
  job: JobWithScore;
  variant: 'default' | 'compact' | 'detailed';
  actions?: JobAction[];
}

const JobCard = ({ job, variant = 'default', actions }) => (
  <Card className="group cursor-pointer transition-colors hover:bg-muted/40">
    <div className="flex items-start gap-4 p-4">
      {/* Company Logo */}
      <CompanyLogo 
        url={job.company_logo} 
        name={job.company} 
        size={variant === 'compact' ? 40 : 48} 
      />
      
      {/* Main Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-lg font-semibold truncate">{job.title}</h3>
            <p className="text-sm text-muted-foreground truncate">{job.company}</p>
          </div>
          <MatchScoreBadge score={job.score} size={variant === 'compact' ? 'sm' : 'md'} />
        </div>
        
        <div className="flex flex-wrap gap-3 mt-2 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <MapPinIcon className="w-4 h-4" />
            {job.location}{job.is_remote && ' · Remote'}
          </span>
          {job.salary_min && (
            <span className="flex items-center gap-1">
              <DollarSignIcon className="w-4 h-4" />
              {formatSalary(job.salary_min, job.salary_max)}
            </span>
          )}
          <span className="flex items-center gap-1">
            <ClockIcon className="w-4 h-4" />
            {formatRelativeTime(job.posted_at)}
          </span>
          <SourceBadge source={job.source} />
        </div>
        
        {variant === 'detailed' && (
          <div className="mt-3 pt-3 border-t border-border">
            <MatchBreakdown scores={job.score_breakdown} />
          </div>
        )}
      </div>
      
      {/* Actions */}
      <div className="flex flex-col gap-2 shrink-0">
        {actions?.map(action => (
          <Button key={action.key} variant={action.variant} size="sm" onClick={action.handler}>
            {action.icon} {action.label}
          </Button>
        ))}
      </div>
    </div>
  </Card>
);
```

#### MatchScoreBadge
```tsx
const MatchScoreBadge = ({ score, size = 'md' }) => {
  const variants = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-1.5 text-sm'
  };
  
  const getVariant = (s: number) => 
    s >= 90 ? 'score-excellent' : s >= 70 ? 'score-good' : s >= 50 ? 'score-fair' : 'score-poor';
  
  return (
    <Badge 
      variant="outline"
      className={`${variants[size]} ${getVariant(score)}`}
      aria-label={`${score}% match`}
    >
      {score}%
    </Badge>
  );
};
```

#### MatchBreakdown (Expandable)
```tsx
const MatchBreakdown = ({ scores, expanded, onToggle }) => (
  <details className="group" open={expanded} onToggle={onToggle}>
    <summary className="flex items-center gap-2 cursor-pointer text-sm font-medium text-muted-foreground">
      <ChevronDownIcon className="w-4 h-4 transition-transform group-open:rotate-180" />
      Match Details
    </summary>
    
    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
      {[
        { key: 'skills', label: 'Skills', icon: CodeIcon },
        { key: 'experience', label: 'Experience', icon: BriefcaseIcon },
        { key: 'location', label: 'Location', icon: MapPinIcon },
        { key: 'salary', label: 'Salary', icon: DollarSignIcon },
        { key: 'culture', label: 'Culture', icon: UsersIcon }
      ].map(({ key, label, icon }) => (
        <div key={key} className="flex flex-col items-center gap-1 p-2 rounded-md bg-muted">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <icon className="w-3 h-3" /> {label}
          </div>
          <ScoreRing 
            value={scores[key] || 0} 
            size={48} 
            strokeWidth={4}
            showLabel
          />
        </div>
      ))}
    </div>
    
    {scores.reasoning && (
      <div className="mt-3 p-3 bg-muted rounded-md text-sm text-muted-foreground">
        <span className="font-medium text-foreground">AI Reasoning:</span>
        <p className="mt-1">{scores.reasoning}</p>
      </div>
    )}
  </details>
);
```

#### ScoreRing (SVG Circular Progress)
```tsx
const ScoreRing = ({ value, size = 56, strokeWidth = 5, showLabel = true }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  
  const color = value >= 90 ? 'oklch(0.55 0.15 150)' : value >= 70 ? 'oklch(0.35 0 0)' : value >= 50 ? 'oklch(0.75 0.12 75)' : 'oklch(0.55 0.2 25)';
  
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg style={{ width: size, height: size, transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="currentColor" strokeWidth={strokeWidth}
          className="text-neutral-200 dark:text-neutral-700"
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500 ease-out"
          style={{ filter: 'drop-shadow(0 0 2px ' + color + '40)' }}
        />
      </svg>
      {showLabel && (
        <span className="absolute text-body-sm font-semibold" style={{ color }}>
          {value}%
        </span>
      )}
    </div>
  );
};
```

#### PipelineKanban (Drag & Drop)
```tsx
const PIPELINE_STAGES = [
  { id: 'applied', label: 'Applied', color: 'info' },
  { id: 'screening', label: 'Screening', color: 'warning' },
  { id: 'interviewing', label: 'Interviewing', color: 'brand' },
  { id: 'offer', label: 'Offer', color: 'success' },
  { id: 'archived', label: 'Archived', color: 'neutral' },
] as const;

const PipelineKanban = ({ applications, onMove, onCardClick }) => (
  <div className="flex gap-4 overflow-x-auto pb-4 h-[calc(100vh-200px)]">
    {PIPELINE_STAGES.map(stage => (
      <KanbanColumn 
        key={stage.id}
        stage={stage}
        items={applications.filter(a => a.status === stage.id)}
        onMove={onMove}
        onCardClick={onCardClick}
      />
    ))}
  </div>
);

const KanbanColumn = ({ stage, items, onMove, onCardClick }) => (
  <div className="flex-shrink-0 w-80 max-h-full flex flex-col">
    <div className="sticky top-0 z-10 flex items-center justify-between px-3 py-2 bg-neutral-50 dark:bg-neutral-800/50 border-b">
      <h3 className="text-caption font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wide">
        {stage.label}
      </h3>
      <Badge variant="neutral" className="text-caption">{items.length}</Badge>
    </div>
    
    <DroppableArea 
      onDrop={e => onMove(e.data.id, stage.id)}
      className="flex-1 overflow-y-auto p-2 space-y-2"
    >
      {items.map(app => (
        <KanbanCard key={app.id} application={app} onClick={onCardClick} />
      ))}
      {items.length === 0 && (
        <div className="h-24 flex items-center justify-center text-neutral-400 text-caption border-2 border-dashed border-neutral-200 rounded-lg">
          Drop here or click + to add
        </div>
      )}
    </div>
    
    <Button variant="ghost" size="sm" className="mx-2 mb-2" onClick={() => onAddClick(stage.id)}>
      <PlusIcon className="w-4 h-4 mr-1" /> Add Application
    </Button>
  </div>
);
```

---

## 5. Screen Designs & Layouts

### 5.1 Layout Structure

#### Main App Shell
```tsx
const AppShell = ({ children }) => (
  <div className="min-h-screen flex flex-col bg-neutral-50 dark:bg-neutral-950">
    {/* Top Bar - Fixed */}
    <header className="sticky top-0 z-40 h-14 border-b bg-white/80 dark:bg-neutral-950/80 backdrop-blur-sm">
      <TopBar />
    </header>
    
    <div className="flex-1 flex overflow-hidden">
      {/* Sidebar - Collapsible */}
      <aside className="w-64 flex-shrink-0 border-r bg-white dark:bg-neutral-950 transition-width duration-200" 
             style={{ width: sidebarCollapsed ? '64px' : '256px' }}>
        <Sidebar />
      </aside>
      
      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-6" id="main-content">
        {children}
      </main>
      
      {/* Right Panel - Contextual (Optional) */}
      <aside className="w-96 flex-shrink-0 border-l bg-white/50 dark:bg-neutral-950/50 backdrop-blur-sm hidden lg:block">
        <RightPanel />
      </aside>
    </div>
  </div>
);
```

#### Top Bar
```
┌────────────────────────────────────────────────────────────────────────────────────────────┐
│ ☰  JobAutomate                                    🔍 Search jobs, companies...        👤 │
│                                                                                              │
│  [Logo]  [Dashboard] [Jobs] [Applications] [Analytics] [Settings]              [Avatar▼]  │
└────────────────────────────────────────────────────────────────────────────────────────────┘
```

#### Sidebar Navigation
```
┌──────────────────────────────────────┐
│  📊 Dashboard              ▲         │
│  ──────────────────────────────────  │
│  🎯  Jobs                      │     │
│     ├─ All Jobs                │     │
│     ├─ Top Matches             │     │
│     ├─ Saved                   │     │
│     └─ Applied                 │     │
│  📋  Applications              │     │
│     ├─ Pipeline (Kanban)       │     │
│     ├─ Timeline                │     │
│     └─ Documents               │     │
│  📈  Analytics                 │     │
│  ⚙️  Settings                  │     │
│     ├─ Profile                 │     │
│     ├─ CV & Documents          │     │
│     ├─ Sources                 │     │
│     ├─ Notifications           │     │
│     └─ Integrations            │     │
│                                  │
│  ──────────────────────────────────  │
│  🧪  Run Pipeline Now    [▶]       │
│  Last run: 2h ago • 47 new jobs   │
└──────────────────────────────────────┘
```

### 5.2 Key Screens

#### Dashboard (Home)
```
┌────────────────────────────────────────────────────────────────────────────────────────────┐
│  Good morning, Alex!                    [Run Pipeline]  [Last run: 6:00 AM • 47 new]      │
├────────────────────────────────────────────────────────────────────────────────────────────┤
│  METRICS BAR                                                                                │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐     │
│  │ 127          │ │ 23           │ │ 5            │ │ 3            │ │ 12h          │     │
│  │ New Matches  │ │ Applied      │ │ Interviewing │ │ Offers       │ │ Avg Response │     │
│  │ +12% vs week │ │ this week    │ │ +2           │ │ this month   │ │ -2h          │     │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘     │
├────────────────────────────────────────────────────────────────────────────────────────────┤
│  TOP MATCHES                                    │  PIPELINE SNAPSHOT                        │
│  ┌──────────────────────────────────────────┐   │  ┌────────────────────────────────────┐  │
│  │ [JobCard: Stripe - 92%]                  │   │  │  Applied (8)  Screening (3)       │  │
│  │ [JobCard: Vercel - 89%]                  │   │  │  Interviewing (2)  Offer (1)      │  │
│  │ [JobCard: Linear - 87%]                  │   │  │  ████████░░  ███░░░░░░░░░░        │  │
│  │ [View All 127 →]                         │   │  │  ██████████  ████████░░░░░░░░      │  │
│  └──────────────────────────────────────────┘   │  └────────────────────────────────────┘  │
│                                                 │                                         │
├────────────────────────────────────────────────┼─────────────────────────────────────────┤
│  RECENT ACTIVITY                               │  SOURCE HEALTH                           │
│  ┌──────────────────────────────────────────┐  │  ┌────────────────────────────────────┐  │
│  │ 10:23 AM  Applied to Stripe (Auto)       │  │  │ LinkedIn RSS    ✓  23 jobs  6:00  │  │
│  │ 09:45 AM  Interview: Vercel scheduled    │  │  │ Indeed API      ✓  15 jobs  6:05  │  │
│  │ 08:30 AM  47 new jobs collected          │  │  │ Company Pages   ⚠  2 failed 6:10  │  │
│  │ 06:00 AM   Daily pipeline completed      │  │  │ Telegram        ✓  9 jobs   6:00  │  │
│  │ [View All Activity →]                    │  │  │ [Configure Sources]                 │  │
│  └──────────────────────────────────────────┘  │  └────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────────────────────┘
```

#### Jobs List View (with Filters)
```
┌────────────────────────────────────────────────────────────────────────────────────────────┐
│  Jobs                                    [Filters ▼]  [Sort: Match ▼]  [View: Cards ▼]   │
├────────────────────────────────────────────────────────────────────────────────────────────┤
│  FILTER SIDEBAR (collapsible)                    │  JOB GRID / LIST                        │
│  ┌────────────────────────────────────────────┐  │  ┌──────────────────────────────────┐  │
│  │ 🎯 Match Score  [████████████░░░░░░░] 70%  │  │  │ [JobCard] [JobCard] [JobCard]    │  │
│  │ 📍 Location                                 │  │  │ [JobCard] [JobCard] [JobCard]    │  │
│  │    ☑ Remote    ☑ San Francisco            │  │  │ [JobCard] [JobCard] [JobCard]    │  │
│  │    ☑ New York     ☐ London                │  │  │                                 │  │
│  │ 💰 Salary Range  [$80k ────────── $300k]   │  │  │        PAGINATION                │  │
│  │ 🏢 Company Size                             │  │  │  ◀ Prev  1  2  3  4  5  Next ▶   │  │
│  │    ☑ Startup   ☑ Growth  ☐ Enterprise     │  │  │  Showing 1-18 of 1,247            │  │
│  │ 📅 Posted Within                            │  │  └──────────────────────────────────┘  │
│  │    ☑ Last 24h  ☑ Last Week  ☐ Last Month  │  │                                         │
│  │ 🔑 Keywords  [python, aws, react___] +    │  │                                         │
│  │ 🚫 Exclude  [sales, support, intern___] + │  │                                         │
│  │ ─────────────────────────────────────────  │  │                                         │
│  │ [Save as Alert]  [Clear All]               │  │                                         │
│  └────────────────────────────────────────────┘  │                                         │
└────────────────────────────────────────────────────────────────────────────────────────────┘
```

#### Job Detail Modal
```
┌────────────────────────────────────────────────────────────────────────────────────────────┐
│  Job Detail                                    ✕                                           │
├────────────────────────────────────────────────────────────────────────────────────────────┤
│  HEADER                                                                                     │
│  [Logo]  Senior Backend Engineer                    92% Match  [Excellent Badge]           │
│          Stripe  •  San Francisco, CA (Hybrid)  •  $180k-$220k  •  Series C  •  2 days    │
│          [Save]  [Share]  [Report]  [Not Interested]                                       │
├────────────────────────────────────────────────────────────────────────────────────────────┤
│  MATCH BREAKDOWN                                    │  QUICK ACTIONS                        │
│  ┌──────────────────────────────────────────────┐  │  ┌──────────────────────────────────┐  │
│  │ Skills      ████████████████████  95%       │  │  │ [Generate Documents] Primary      │  │
│  │ Experience  ██████████████████░░  88%       │  │  │ [Apply Now]           Primary      │  │
│  │ Location    ████████████████████  95%       │  │  │ [Save for Later]      Secondary    │  │
│  │ Salary      ██████████████████░░  90%       │  │  │ [Add to Calendar]     Ghost        │  │
│  │ Culture     ████████████████░░░░  85%       │  │  └──────────────────────────────────┘  │
│  └──────────────────────────────────────────────┘  │                                         │
│  [Show AI Reasoning ▼]                                                                      │
│  "Your 6 years of Python/Postgres experience directly matches their core stack..."          │
├────────────────────────────────────────────────────────────────────────────────────────────┤
│  TABS: [Description] [Requirements] [Benefits] [Company] [Similar Jobs]                    │
│  ────────────────────────────────────────────────────────────────────────────────────────  │
│  Description content...                                                                     │
└────────────────────────────────────────────────────────────────────────────────────────────┘
```

#### Document Review Screen (Side-by-Side)
```
┌────────────────────────────────────────────────────────────────────────────────────────────┐
│  Review Documents: Senior Backend Engineer @ Stripe                    [Download PDFs]  ✕ │
├────────────────────────────────────────────────────────────────────────────────────────────┤
│  TABS: [CV Comparison] [Cover Letter] [ATS Check] [Settings]                                │
├────────────────────────────────────────────────────────────────────────────────────────────┤
│  ORIGINAL CV                                    TAILORED CV                                 │
│  ┌─────────────────────────────────────────┐  ┌─────────────────────────────────────────┐  │
│  │ ALEX CHEN                               │  │ ALEX CHEN                               │  │
│  │ Senior Backend Engineer                 │  │ Senior Backend Engineer — Stripe Focus │  │
│  │ ─────────────────────────────────────   │  │ ─────────────────────────────────────   │  │
│  │ EXPERIENCE                              │  │ EXPERIENCE                              │  │
│  │ ● Built APIs serving 10M+ req/day      │  │ ● Built high-throughput APIs (10M+/day)│  │
│  │   using Python/FastAPI                  │  │   using Python/FastAPI — directly      │  │
│  │   ▼ Changed: "Built APIs" → "Built      │  │   relevant to Stripe's payment volume  │  │
│  │     high-throughput APIs"               │  │   requirements                          │  │
│  │ ● Optimized Postgres queries, 40%      │  │ ● Optimized Postgres queries, reduced  │  │
│  │   latency reduction                     │  │   p99 latency by 40% — aligns with     │  │
│  │   ▼ Added metric                        │  │   Stripe's performance culture         │  │
│  │ ● Led migration to Kubernetes          │  │ ● Led migration to Kubernetes (EKS)    │  │
│  │   ▼ Added cloud provider                │  │   — experience with Stripe's cloud     │  │
│  │                                         │  │   infrastructure preferences             │  │
│  │ SKILLS                                  │  │ SKILLS                                  │  │
│  │ Python ●●●●●  Postgres ●●●●●  AWS ●●●●○ │  │ Python ●●●●●  Postgres ●●●●●  AWS ●●●●● │  │
│  │ React ●●●○○  Docker ●●●●○  K8s ●●●○○   │  │ React ●●●○○  Docker ●●●●○  K8s ●●●●●  │  │
│  │                                         │  │ ▼ Added: Stripe API, Webhooks, PCI-DSS  │  │
│  └─────────────────────────────────────────┘  └─────────────────────────────────────────┘  │
│                                                                                              │
│  LEGEND:  Green = Added/Enhanced    Red = Removed    Gray = Unchanged                      │
│  [Accept All]  [Accept Changes Individually]  [Regenerate]  [Back to Job]                  │
└────────────────────────────────────────────────────────────────────────────────────────────┘
```

#### Pipeline Kanban View
```
┌────────────────────────────────────────────────────────────────────────────────────────────┐
│  Applications Pipeline                              [Filters] [Export] [View Options]     │
├────────────────────────────────────────────────────────────────────────────────────────────┤
│  APPLIED (12)              SCREENING (3)           INTERVIEWING (2)        OFFER (1)      │
│  ┌─────────────────────┐   ┌─────────────────────┐  ┌─────────────────────┐ ┌───────────┐ │
│  │ □ Stripe            │   │ □ Vercel            │  │ □ Linear            │ │ □ Notion  │ │
│  │ Senior Backend      │   │ Platform Engineer   │  │ Full Stack Eng      │ │ Staff Eng │ │
│  │ 92% • 2d ago        │   │ 89% • 5d ago        │  │ 87% • 1w ago        │ │ 94% • 3d  │ │
│  │ 📄v3 📝v1 ✓confirmed│   │ 📄v3 📝v1           │  │ 📄v3 📝v1 📅Jan 25  │ │ 📄v3 📝v1 │ │
│  │ [⋮]                 │   │ [⋮]                 │  │ [⋮]                 │ │ [⋮]       │ │
│  ├─────────────────────┤   ├─────────────────────┤  ├─────────────────────┤ ├───────────┤ │
│  │ □ Databricks        │   │ □ Anthropic         │  │ □ OpenAI            │ │ + Add     │ │
│  │ ML Engineer         │   │ Research Engineer   │  │ Applied Researcher  │ │           │ │
│  │ 78% • 1w ago        │   │ 82% • 3d ago        │  │ 76% • 2w ago        │ │           │ │
│  │ 📄v2 📝v1           │   │ 📄v3 📝v1 📅Jan 22  │  │ 📄v3 📝v1           │ │           │ │
│  │ [⋮]                 │   │ [⋮]                 │  │ [⋮]                 │ │           │ │
│  └─────────────────────┘   └─────────────────────┘  └─────────────────────┘ └───────────┘ │
│  + Add Application         + Add Application       + Add Application       + Add Application │
├────────────────────────────────────────────────────────────────────────────────────────────┤
│  ARCHIVED (45) - [Show/Hide]                                                                 │
│  [Compact list view with: Company | Role | Status | Date | Outcome]                        │
└────────────────────────────────────────────────────────────────────────────────────────────┘
```

#### Settings - Source Configuration
```
┌────────────────────────────────────────────────────────────────────────────────────────────┐
│  Settings / Sources                                    [+ Add Source]                       │
├────────────────────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────────────────────────────────┐  │
│  │ SOURCE CARDS                                                                           │  │
│  │ ┌────────────────────────────────────────────────────────────────────────────────┐   │  │
│  │ │ 🔗 LinkedIn RSS                    ● Active    Last: 6:00 AM    23 jobs       │   │  │
│  │ │ Keywords: python, backend, api     Schedule: 0 6 * * *    Success rate: 98%   │   │  │
│  │ │ [Edit] [Test] [Pause] [Logs] [⋮]                                                │   │  │
│  │ └────────────────────────────────────────────────────────────────────────────────┘   │  │
│  │ ┌────────────────────────────────────────────────────────────────────────────────┐   │  │
│  │ │ 🔌 Indeed API                      ● Active    Last: 6:05 AM    15 jobs       │   │  │
│  │ │ Location: US, Remote               Schedule: 0 6 * * *    Success rate: 100%  │   │  │
│  │ │ [Edit] [Test] [Pause] [Logs] [⋮]                                                │   │  │
│  │ └────────────────────────────────────────────────────────────────────────────────┘   │  │
│  │ ┌────────────────────────────────────────────────────────────────────────────────┐   │  │
│  │ │ 🤖 Playwright: Company Careers      ○ Inactive  Never run       0 jobs        │   │  │
│  │ │ URL: https://acme.com/careers       Schedule: 0 7 * * 1                     │   │  │
│  │ │ [Configure] [Test] [Activate] [⋮]                                               │   │  │
│  │ └────────────────────────────────────────────────────────────────────────────────┘   │  │
│  └──────────────────────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────────────────────┘
```

#### Add Source Wizard (Playwright)
```
┌────────────────────────────────────────────────────────────────────────────────────────────┐
│  Add Source: Playwright Scraper                    Step 1 of 4    [Cancel]    [Next →]      │
├────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                              │
│  BASIC INFO                                                                                   │
│  ────────────────────────────────────────────────────────────────────────────────────────  │
│  Source Name        [Company Careers - Acme Corp                    ]                       │
│  Description        [Custom scraper for Acme's career page           ]                       │
│                                                                                              │
│  NAVIGATION                                                                                  │
│  ────────────────────────────────────────────────────────────────────────────────────────  │
│  Start URL          [https://acme.com/careers                              ]               │
│  Wait for Selector  [.job-listings                   ]  Timeout: [10] seconds             │
│  Requires Login     [☐]  (If checked, credentials step appears)                            │
│                                                                                              │
│  LIST PAGE SELECTORS                                                                          │
│  ────────────────────────────────────────────────────────────────────────────────────────  │
│  Job Card Container [.job-card                                             ]               │
│  Fields (CSS Selectors):                                                                        │
│    Title            [.job-title a                    ]  Attribute: [text ▼]                 │
│    URL              [.job-title a                    ]  Attribute: [href  ▼]                 │
│    Location         [.job-location                   ]  Attribute: [text ▼]                 │
│    Department       [.job-department                 ]  Attribute: [text ▼]                 │
│    Posted Date      [.job-date                       ]  Attribute: [datetime▼]              │
│                                                                                              │
│  Pagination          [☑ Enabled]  Next Button: [.pagination .next]  Max Pages: [10]        │
│                                                                                              │
│  [Test Selectors →]  (Opens preview pane with extracted data)                               │
│                                                                                              │
└────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Responsive Breakpoints

```css
:root {
  --breakpoint-sm: 640px;   /* Mobile landscape / small tablet */
  --breakpoint-md: 768px;   /* Tablet portrait */
  --breakpoint-lg: 1024px;  /* Tablet landscape / small desktop */
  --breakpoint-xl: 1280px;  /* Desktop */
  --breakpoint-2xl: 1536px; /* Large desktop */
}

/* Sidebar behavior */
@media (max-width: 1023px) {
  .sidebar { position: fixed; left: -256px; z-index: 50; }
  .sidebar.open { left: 0; }
  .sidebar-overlay { display: block; }
}

@media (min-width: 1024px) {
  .sidebar { position: sticky; top: 3.5rem; height: calc(100vh - 3.5rem); }
}
```

### Component Adaptations

| Component | Mobile (<768px) | Tablet (768-1024px) | Desktop (>1024px) |
|-----------|-----------------|---------------------|-------------------|
| JobCard | Full width, stacked actions | 2-col grid, compact | 3-col grid, full actions |
| Pipeline | Horizontal scroll, swipe | Horizontal scroll | Fixed columns, drag-drop |
| Job Detail | Full-screen modal | Side panel (50%) | Modal (800px max) |
| Doc Review | Stacked (Original → Tailored) | Side-by-side | Side-by-side, diff highlights |
| Settings | Stacked sections | 2-col layout | Sidebar + content |
| Tables | Card-based list | Horizontal scroll | Full table |

---

## 7. Accessibility (WCAG 2.2 AA)

### 7.1 Checklist

- [ ] **Color Contrast**: All text ≥ 4.5:1, UI elements ≥ 3:1
- [ ] **Keyboard Navigation**: All interactive elements reachable, visible focus rings
- [ ] **Focus Management**: Modals trap focus, return on close
- [ ] **ARIA Labels**: Icon buttons, status indicators, live regions
- [ ] **Semantic HTML**: Proper heading hierarchy, landmarks
- [ ] **Reduced Motion**: Respect `prefers-reduced-motion`
- [ ] **Screen Readers**: Tested with NVDA/VoiceOver
- [ ] **Zoom**: Functional at 200% zoom
- [ ] **Touch Targets**: Minimum 44×44px on mobile
- [ ] **Icons**: Lucide SVG only — no emoji as UI icons

### 7.2 Focus Ring System
```css
/* Prefer shadcn ring utilities: focus-visible:ring-ring */
:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--background), 0 0 0 4px var(--ring);
}
```

### 7.3 Live Regions for Dynamic Content
```tsx
// Pipeline updates
<div aria-live="polite" aria-atomic="true" className="sr-only">
  {announcement}
</div>

// Loading states
<div role="status" aria-live="polite" className="sr-only">
  Loading {count} jobs...
</div>
```

---

## 8. Dark Mode Implementation

### 8.1 Strategy
- shadcn CSS variables on `:root` / `.dark`
- `class="dark"` on `<html>` (next-themes)
- Light-first; system preference + manual toggle
- Persist preference in localStorage + user profile

### 8.2 Theme Toggle Component
```tsx
import { MoonIcon, SunIcon, MonitorIcon } from "lucide-react"

const ThemeToggle = () => {
  const [theme, setTheme] = useTheme(); // 'light' | 'dark' | 'system'
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Theme">
          {theme === 'dark' ? <MoonIcon /> : theme === 'light' ? <SunIcon /> : <MonitorIcon />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
          <DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">Dark</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">System</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
```

---

## 9. Loading & Empty States

### 9.1 Skeleton Loaders
```tsx
const JobCardSkeleton = () => (
  <Card className="animate-pulse">
    <div className="p-4 space-y-3">
      <div className="flex gap-4">
        <div className="w-12 h-12 rounded-lg bg-neutral-200 dark:bg-neutral-700" />
        <div className="flex-1 space-y-2">
          <div className="h-5 w-3/4 bg-neutral-200 dark:bg-neutral-700 rounded" />
          <div className="h-4 w-1/2 bg-neutral-200 dark:bg-neutral-700 rounded" />
          <div className="h-4 w-1/3 bg-neutral-200 dark:bg-neutral-700 rounded" />
        </div>
        <div className="w-24 h-8 bg-neutral-200 dark:bg-neutral-700 rounded" />
      </div>
      <div className="flex gap-3 text-sm">
        <div className="h-4 w-20 bg-neutral-200 dark:bg-neutral-700 rounded-full" />
        <div className="h-4 w-24 bg-neutral-200 dark:bg-neutral-700 rounded-full" />
        <div className="h-4 w-16 bg-neutral-200 dark:bg-neutral-700 rounded-full" />
      </div>
    </div>
  </Card>
);
```

### 9.2 Empty States
```tsx
const EmptyState = ({ 
  icon, 
  title, 
  description, 
  action 
}) => (
  <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
    <div className="w-16 h-16 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mb-4">
      {icon}
    </div>
    <h3 className="text-h3 font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
      {title}
    </h3>
    <p className="text-body text-neutral-500 dark:text-neutral-400 max-w-xs mb-6">
      {description}
    </p>
    {action && (
      <Button onClick={action.onClick}>
        {action.icon} {action.label}
      </Button>
    )}
  </div>
);

// Usage examples:
<EmptyState
  icon={<InboxIcon className="w-8 h-8 text-neutral-400" />}
  title="No applications yet"
  description="Your pipeline is empty. Start by generating documents for your top matches."
  action={{ label: "View Top Matches", onClick: () => navigate('/jobs'), icon: <ArrowRightIcon /> }}
/>
```

---

## 10. Design Tokens Export (Figma/Code Sync)

### 10.1 Token Structure (JSON)
```json
{
  "color": {
    "background": "oklch(1 0 0)",
    "foreground": "oklch(0.145 0 0)",
    "primary": "oklch(0.205 0 0)",
    "primaryForeground": "oklch(0.985 0 0)",
    "muted": "oklch(0.97 0 0)",
    "mutedForeground": "oklch(0.556 0 0)",
    "border": "oklch(0.922 0 0)",
    "ring": "oklch(0.708 0 0)",
    "destructive": "oklch(0.577 0.245 27.325)",
    "semantic": {
      "success": "status chips only",
      "warning": "status chips only",
      "error": "destructive / FormMessage"
    }
  },
  "typography": {
    "fontFamilies": { "sans": "Geist Sans", "mono": "Geist Mono" },
    "fontSizes": { "display": "3rem", "h1": "2rem", "h2": "1.5rem", "body": "1rem" },
    "fontWeights": { "normal": 400, "medium": 500, "semibold": 600, "bold": 700 },
    "lineHeights": { "tight": 1.1, "normal": 1.5, "relaxed": 1.6 }
  },
  "radius": { "DEFAULT": "0.625rem" },
  "animation": { "durations": { "fast": "100ms", "normal": "200ms", "slow": "300ms" } },
  "breakpoints": { "sm": "640px", "md": "768px", "lg": "1024px", "xl": "1280px", "2xl": "1536px" },
  "shadcn": {
    "style": "new-york",
    "baseColor": "neutral",
    "cssVariables": true
  }
}
```

---

## 11. Implementation Checklist

### Phase 1: Foundation (Week 1–2 / P1.4)
- [ ] Next.js 15 scaffold in `web/`
- [ ] `npx shadcn@latest init` — **new-york** + **neutral** (B&W)
- [ ] Base components via CLI/MCP: Button, Input, Card, Badge, Dialog, Sonner, Form, Skeleton, Sidebar
- [ ] Theme provider (`next-themes`) + light-first dark mode
- [ ] Layout shell (Sidebar + TopBar + Main)
- [ ] Auth pages (login / register) using shadcn Form
- [ ] Responsive breakpoints tested
- [ ] MCP `get_audit_checklist` run

### Phase 2: Core Screens (Week 3-4)
- [ ] Dashboard with metrics + top matches + pipeline snapshot
- [ ] Jobs list with filters, sorting, pagination
- [ ] Job detail modal with match breakdown
- [ ] Pipeline Kanban with drag-drop

### Phase 3: Advanced Features (Week 5-6)
- [ ] Document review (side-by-side diff)
- [ ] Source configuration wizard
- [ ] Settings panels (Profile, CV, Notifications)
- [ ] Onboarding flow (5 steps)

### Phase 4: Polish (Week 7)
- [ ] Loading skeletons everywhere
- [ ] Empty states for all views
- [ ] Keyboard navigation audit
- [ ] Screen reader testing
- [ ] Dark mode refinement
- [ ] Animation polish

---

*Document Version: 1.1 | Last Updated: 2026-08-04 | Owner: Design Engineering*  
*Visual system: classic shadcn/ui **new-york** + **neutral** (black & white). MCP: `.cursor/mcp.json` → `shadcn`.*