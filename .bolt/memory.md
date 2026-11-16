# Project memory

## Product intent & audience

- Next.js app for clinic/medical visit management with multi-language support
- Pilot phase; audience includes clinics and an owner/admin role with plan management
- Languages: Russian (primary), Chechen (чеченский) being added; some pages still Russian-only for pilot
- Features include: login/auth, visit list, visit creation, owner page with plan

## Brand personality & voice

- Communication about fixes and status is direct and transparent about limitations
- Bilingual/multilingual UX is a core requirement, not an afterthought

## Visual design & UX direction

- Next.js with Tailwind CSS, shadcn/ui components, Lucide React icons
- "use client" directive required for components using useState/useEffect
- Must avoid hydration attribute mismatch warnings (class, style)

## Decisions, constraints & rationale

- **Backend:** Supabase (env vars required at runtime)
- **Build mode:** Switched from static prerendering to on-demand build (`dynamic = 'force-dynamic'` or equivalent in root layout) because all pages fetch data and require Supabase env vars; static prerender caused build failures (exit code 1) on 5 pages
- **Chechen translation:** Done manually; Google Translate not accessible from the build environment; limited dictionary sources available; translations are unverified drafts needing native-speaker review before production use
- **Remaining Russian-only for pilot:** visit list, visit creation, owner/plan page
- **TypeScript:** Type checking passes as part of build pipeline

## Open questions & assumptions

- Chechen translations need native-speaker verification before clinic-facing deployment
- Whether to fully translate all remaining Russian-only pages for pilot or defer
- Next planned features: office hours (часы приёма) and dashboard panel
- Supabase environment variables assumed present at runtime but not during build