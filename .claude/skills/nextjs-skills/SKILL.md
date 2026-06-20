---
name: nextjs-app-router-fundamentals
description: Guide for working with Next.js App Router (Next.js 13+). Use when migrating from Pages Router to App Router, creating layouts, implementing routing, handling metadata, or building Next.js 13+ applications. Activates for App Router migration, layout creation, routing patterns, or Next.js 13+ development tasks.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# Next.js App Router Fundamentals

## Overview

Provide comprehensive guidance for Next.js App Router (Next.js 13+), covering migration from Pages Router, file-based routing conventions, layouts, metadata handling, and modern Next.js patterns.

## TypeScript: NEVER Use `any` Type

**CRITICAL RULE:** This codebase has `@typescript-eslint/no-explicit-any` enabled. Using `any` will cause build failures.

**❌ WRONG:**
```typescript
function handleSubmit(e: any) { ... }
const data: any[] = [];
```

**✅ CORRECT:**
```typescript
function handleSubmit(e: React.FormEvent<HTMLFormElement>) { ... }
const data: string[] = [];
```

### Common Next.js Type Patterns

```typescript
// Page props
function Page({ params }: { params: { slug: string } }) { ... }
function Page({ searchParams }: { searchParams: { [key: string]: string | string[] | undefined } }) { ... }

// Form events
const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => { ... }
const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => { ... }

// Server actions
async function myAction(formData: FormData) { ... }
```

## When to Use This Skill

Use this skill when:
- Migrating from Pages Router (`pages/` directory) to App Router (`app/` directory)
- Creating Next.js 13+ applications from scratch
- Working with layouts, templates, and nested routing
- Implementing metadata and SEO optimizations
- Building with App Router routing conventions
- Handling route groups, parallel routes, or intercepting routes basics

## Core Concepts

### App Router vs Pages Router

**Pages Router (Legacy - Next.js 12 and earlier):**
```
pages/
├── index.tsx              # Route: /
├── about.tsx              # Route: /about
├── _app.tsx               # Custom App component
├── _document.tsx          # Custom Document component
└── api/                   # API routes
    └── hello.ts           # API endpoint: /api/hello
```

**App Router (Modern - Next.js 13+):**
```
app/
├── layout.tsx             # Root layout (required)
├── page.tsx               # Route: /
├── about/                 # Route: /about
│   └── page.tsx
├── blog/
│   ├── layout.tsx         # Nested layout
│   └── [slug]/
│       └── page.tsx       # Dynamic route: /blog/:slug
└── api/                   # Route handlers
    └── hello/
        └── route.ts       # API endpoint: /api/hello
```

### File Conventions

**Special Files in App Router:**
- `layout.tsx` - Shared UI for a segment and its children (preserves state, doesn't re-render)
- `page.tsx` - Unique UI for a route, makes route publicly accessible
- `loading.tsx` - Loading UI with React Suspense
- `error.tsx` - Error UI with Error Boundaries
- `not-found.tsx` - 404 UI
- `template.tsx` - Similar to layout but re-renders on navigation
- `route.ts` - API endpoints (Route Handlers)

## Migration Guide: Pages Router to App Router

### Step 1: Understand the Current Structure

Examine existing Pages Router setup:
- Read `pages/` directory structure
- Identify `_app.tsx` - handles global state, layouts, providers
- Identify `_document.tsx` - customizes HTML structure
- Note metadata usage (`next/head`, `<Head>` component)
- List all routes and dynamic segments

### Step 2: Create Root Layout

Create `app/layout.tsx` - **REQUIRED** for all App Router applications:

```typescript
// app/layout.tsx
export const metadata = {
  title: 'My App',
  description: 'App description',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

**Migration Notes:**
- Move `_document.tsx` HTML structure to `layout.tsx`
- Move `_app.tsx` global providers/wrappers to `layout.tsx`
- Convert `<Head>` metadata to `metadata` export
- The root layout **MUST** include `<html>` and `<body>` tags

### Step 3: Migrate Pages to Routes

**Simple Page Migration:**
```typescript
// Before: pages/index.tsx
import Head from 'next/head';

export default function Home() {
  return (
    <>
      <Head>
        <title>Home Page</title>
      </Head>
      <main>
        <h1>Welcome</h1>
      </main>
    </>
  );
}
```

```typescript
// After: app/page.tsx
export default function Home() {
  return (
    <main>
      <h1>Welcome</h1>
    </main>
  );
}

export const metadata = {
  title: 'Home Page',
};
```

## Metadata Handling

### Static Metadata

```typescript
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'My Page',
  description: 'Page description',
  keywords: ['nextjs', 'react'],
  openGraph: {
    title: 'My Page',
    description: 'Page description',
    images: ['/og-image.jpg'],
  },
};
```

### Dynamic Metadata

```typescript
export async function generateMetadata({
  params
}: {
  params: { slug: string }
}): Promise<Metadata> {
  const post = await getPost(params.slug);

  return {
    title: post.title,
    description: post.excerpt,
  };
}
```

## Layouts and Nesting

```typescript
// app/layout.tsx - Root layout
export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <Header />
        {children}
        <Footer />
      </body>
    </html>
  );
}

// app/blog/layout.tsx - Blog layout
export default function BlogLayout({ children }) {
  return (
    <div>
      <BlogSidebar />
      <main>{children}</main>
    </div>
  );
}
```

## Routing Patterns

### Dynamic Routes

```typescript
// app/blog/[slug]/page.tsx
export default function BlogPost({
  params
}: {
  params: { slug: string }
}) {
  return <article>Post: {params.slug}</article>;
}
```

### Route Groups

Group routes without affecting URL:

```
app/
├── (marketing)/
│   ├── about/
│   │   └── page.tsx      # /about
│   └── contact/
│       └── page.tsx      # /contact
└── (shop)/
    └── products/
        └── page.tsx      # /products
```

## generateStaticParams

```typescript
// app/blog/[id]/page.tsx
export async function generateStaticParams() {
  const posts = await fetch('https://api.example.com/posts').then(r => r.json());
  return posts.map((post: { slug: string }) => ({ slug: post.slug }));
}

export const dynamicParams = true; // default - allows runtime generation

export default function BlogPost({ params }: { params: { id: string } }) {
  return <article>Post {params.id}</article>;
}
```

## Common Migration Pitfalls

### Pitfall 1: Forgetting Root Layout HTML Tags

**Wrong:**
```typescript
export default function RootLayout({ children }) {
  return <div>{children}</div>; // Missing <html> and <body>
}
```

**Correct:**
```typescript
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

### Pitfall 2: Using `next/head` in App Router

**Wrong:**
```typescript
import Head from 'next/head';
export default function Page() {
  return (
    <>
      <Head><title>Title</title></Head>
      <main>Content</main>
    </>
  );
}
```

**Correct:**
```typescript
export const metadata = { title: 'Title' };
export default function Page() {
  return <main>Content</main>;
}
```

## Server Components vs Client Components

### Default: Server Components

All components in `app/` are Server Components by default:

```typescript
// app/page.tsx - Server Component (default)
export default async function Page() {
  const data = await fetch('https://api.example.com/data');
  const json = await data.json();
  return <div>{json.title}</div>;
}
```

### Client Components

Use `'use client'` directive when you need React hooks, browser APIs, or event handlers:

```typescript
'use client';
import { useState } from 'react';

export default function Counter() {
  const [count, setCount] = useState(0);
  return (
    <button onClick={() => setCount(count + 1)}>
      Count: {count}
    </button>
  );
}
```

## Data Fetching Patterns

### Server Component Data Fetching

```typescript
async function getPosts() {
  const res = await fetch('https://api.example.com/posts', {
    next: { revalidate: 3600 }
  });
  return res.json();
}

export default async function PostsPage() {
  const posts = await getPosts();
  return (
    <ul>
      {posts.map(post => (
        <li key={post.id}>{post.title}</li>
      ))}
    </ul>
  );
}
```

### Parallel Data Fetching

```typescript
export default async function Page() {
  const [posts, users] = await Promise.all([
    fetch('https://api.example.com/posts').then(r => r.json()),
    fetch('https://api.example.com/users').then(r => r.json()),
  ]);
  return (/* render */);
}
```

## Quick Reference

### File Structure Mapping

| Pages Router | App Router | Purpose |
|-------------|-----------|---------|
| `pages/index.tsx` | `app/page.tsx` | Home route |
| `pages/about.tsx` | `app/about/page.tsx` | About route |
| `pages/[id].tsx` | `app/[id]/page.tsx` | Dynamic route |
| `pages/_app.tsx` | `app/layout.tsx` | Global layout |
| `pages/_document.tsx` | `app/layout.tsx` | HTML structure |
| `pages/api/hello.ts` | `app/api/hello/route.ts` | API route |
