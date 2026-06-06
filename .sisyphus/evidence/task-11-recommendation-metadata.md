# Task 11 Recommendation Metadata <!-- oc:id=sec_aa -->

Each curated recommendation entry should include:

- `serverId`
- `displayName`
- `category`
- `rationale`
- `tags`
- `authComplexity`
- `writeRisk`
- `registryBacked`
- `sourceLabel`

## Initial top 10 policy <!-- oc:id=sec_ab -->

- GitHub — code hosting, issues, PR workflows
- Notion — docs/wiki knowledge workflows
- Google Workspace — docs, drive, mail, calendar workflows
- Slack — team communication triage
- Linear — issue tracking and sprint operations
- Sentry — error investigation
- Context7 — documentation retrieval
- Postgres — direct data inspection
- Supabase — hosted Postgres + auth/storage workflows
- Stripe — payments and billing operations

If any entry lacks direct upstream registry proof, mark `registryBacked = false` and `sourceLabel = curated/manual`.