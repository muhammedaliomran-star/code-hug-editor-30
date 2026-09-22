# Routes

TanStack Start uses **file-based routing**. Every `.tsx` file in this directory
defines a route. Do **not** create `src/pages/`, `src/routes/_app/index.tsx`, or
`app/layout.tsx` — those are Next.js / Remix conventions. The only root layout
is `src/routes/__root.tsx`.

## Conventions

| File | URL |
| --- | --- |
| `index.tsx` | `/` |
| `about.tsx` | `/about` |
| `users/index.tsx` | `/users` |
| `users/$id.tsx` | `/users/:id` (dynamic — bare `$`, no curly braces) |
| `posts/{-$category}.tsx` | `/posts/:category?` (optional segment) |
| `files/$.tsx` | `/files/*` (splat — read via `_splat` param, never `*`) |
| `_layout.tsx` | layout route (renders children via `<Outlet />`) |
| `__root.tsx` | app shell — wraps every page; preserve `<Outlet />` |

`routeTree.gen.ts` is auto-generated. Don't edit it by hand.

## Route template (#16)

Authenticated app pages MUST use the shared template — never hand-write
`ssr`/`beforeLoad`/`head`:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { appRoute } from "@/lib/route-meta";
import MyPage from "@/pages/MyPage";

export const Route = createFileRoute("/mypage")({
  ...appRoute({ title: "اسم الصفحة", description: "...", path: "/mypage" }),
  component: MyPage,
});
```

The template sets `ssr: false`, `beforeLoad: requireAuth`, and a complete
head (title + description + `noindex, nofollow` + OpenGraph + Twitter +
canonical). Keep the `_` character out of file names — it is a literal
(`inventory.new.tsx`, never `inventory_.new.tsx`). One URL = one file;
duplicates (`driver.tsx` vs `courier.tsx`) are deleted, not aliased.

Public routes (landing, auth, legal, kiosks like `/courier`, `/receipt/$token`)
keep custom heads and stay `noindex` unless the page is meant for search.
