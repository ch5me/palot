# Task 16 — Artifact generation from sources <!-- oc:id=sec_aa -->

## Goal <!-- oc:id=sec_ab -->
Define how document/project sources become editable Firefly artifacts while preserving grounding and reusing existing artifact surfaces instead of creating a second subsystem.

## Core integration decision <!-- oc:id=sec_ac -->
### Durable source-backed artifact model + existing Firefly presentation surface <!-- oc:id=sec_ad -->
Use two layers:
1. durable source-backed artifact records (`PdfGroundedArtifact`, `PdfArtifactSourceRef`) <!-- oc:id=item_aa -->
1. optional session-scoped presentation mirrors in existing GenUI artifact/widget/side-panel surfaces <!-- oc:id=item_ab -->

This keeps source grounding durable while still reusing current Firefly artifact browsing UX.

## Scope decision <!-- oc:id=sec_ae -->
### Durable artifact scope <!-- oc:id=sec_af -->
Artifacts generated from document/project sources should be project-scoped durable records.

Why:
- artifact meaning outlives one session
- may be regenerated or reopened later
- should remain tied to project documents and citations

### Session presentation scope <!-- oc:id=sec_ag -->
Pinning, local prop tweaks, and placement stay session-scoped UI concerns, just like current GenUI artifact system.

## Generation flow <!-- oc:id=sec_ah -->
1. user asks for artifact from one document or project corpus <!-- oc:id=item_ac -->
1. system runs grounded retrieval / citation generation <!-- oc:id=item_ad -->
1. output stored as `PdfGroundedArtifact` <!-- oc:id=item_ae -->
1. every claim/sourceable section stores one or more `PdfArtifactSourceRef` rows with shared locators <!-- oc:id=item_af -->
1. UI may mirror resulting artifact into existing session artifact surface for immediate editing/pinning <!-- oc:id=item_ag -->

## Artifact record contract <!-- oc:id=sec_ai -->
From T8:
- `PdfGroundedArtifact { id, projectId, documentId?, title, component, props, sourceRefs[] }`
- `PdfArtifactSourceRef { id, artifactId, label?, locator }`

### Meaning <!-- oc:id=sec_aj -->
- `component` / `props` let artifact render through existing GenUI-friendly display path when suitable
- `sourceRefs[]` preserves claim-level grounding outside transient chat text
- one artifact may reference multiple documents

## Existing artifact surface integration path <!-- oc:id=sec_ak -->
### Reuse, do not replace <!-- oc:id=sec_al -->
Current artifact surfaces:
- session widget (`chat-inline-right`) for pinned live artifacts
- side-panel `ArtifactsPanel` for inventory/browsing
- prompt context injection via `atoms/chat.ts`

### Integration strategy <!-- oc:id=sec_am -->
When a durable grounded artifact is generated:
- create or map a session-visible artifact descriptor for current session
- keep durable record as source of truth
- let existing `GenUiArtifactCard` / `ArtifactsPanel` render a session mirror or adapter object

This means current artifact UI becomes a presentation layer for durable source-backed artifacts, not a competing storage system.

## Prompt-context behavior <!-- oc:id=sec_an -->
### Reuse existing artifact context seam <!-- oc:id=sec_ao -->
`atoms/chat.ts` already appends up to 8 recent artifacts into outbound prompts.
For source-backed artifacts:
- keep same stable-id reference pattern
- extend artifact context later to mention that artifact is grounded and may reference source docs/claims
- do not duplicate with a second `[Grounded Artifact Context]` block unless proven necessary

## Claim/source linkage rules <!-- oc:id=sec_ap -->
### Requirement <!-- oc:id=sec_aq -->
Any claim that can be cited must retain locator-backed source refs.

### Minimum rule <!-- oc:id=sec_ar -->
At artifact level:
- artifact has `sourceRefs[]`

Better later refinement:
- major sections/claims inside artifact props can carry source-ref ids or locator bindings

### Forbidden <!-- oc:id=sec_as -->
- artifact as plain generated text blob with no source linkage
- stripping citation data when moving from chat answer -> editable artifact
- storing only prose footnotes without machine-usable locators

## Editable artifact behavior <!-- oc:id=sec_at -->
### Allowed edits <!-- oc:id=sec_au -->
- local presentation prop tweaks
- reorganizing grounded sections
- annotation-style follow-up edits

### Constraint <!-- oc:id=sec_av -->
Edits must not silently sever source refs.
If text/sections change enough that grounding no longer matches original claims:
- either preserve old refs explicitly
- or mark claim as ungrounded/needs regeneration

Do not pretend edited unsupported prose is still grounded automatically.

## Single coherent artifact path <!-- oc:id=sec_aw -->
To avoid duplicate systems:
- no separate `pdf-artifacts-panel`
- no parallel artifact id namespace unrelated to existing artifact cards unless durable ids map cleanly into them
- one visible artifact inventory surface: existing `ArtifactsPanel`
- one optional pinned live placement surface: existing session widget area

## Document vs project source behavior <!-- oc:id=sec_ax -->
### Document-scoped artifact <!-- oc:id=sec_ay -->
- `documentId` set on artifact
- source refs may all point to same doc

### Project-scoped artifact <!-- oc:id=sec_az -->
- `documentId` optional/null on artifact root
- `sourceRefs[]` may span many docs
- each source ref still carries its own `documentId` via locator

## Failure behavior <!-- oc:id=sec_ba -->
### Existing artifact surface already active <!-- oc:id=sec_bb -->
If artifacts already exist in session:
- new source-backed artifact appears in same surface list
- no second inventory path
- stable ids prevent collisions

### Artifact created but no source refs <!-- oc:id=sec_bc -->
Treat as failure/degraded generation state for grounded workflow.
Either:
- block artifact from being labeled grounded
- or mark clearly as ungrounded draft

## Acceptance check <!-- oc:id=sec_bd -->
- artifact scope and source-link model defined: yes
- existing artifact surface integration path defined: yes
- generated artifact claims can reference source locators: yes

## QA mapping <!-- oc:id=sec_be -->
### Generated artifact preserves source linkage <!-- oc:id=sec_bf -->
Expected proof:
1. generate artifact from project/docs <!-- oc:id=item_ah -->
1. artifact appears in existing Firefly artifact surface <!-- oc:id=item_ai -->
1. source-link interaction for one claim resolves through locator-backed source ref <!-- oc:id=item_aj -->

### Failure path — artifact surface integration conflict <!-- oc:id=sec_bg -->
Expected proof:
1. generate grounded artifact while other artifacts already exist <!-- oc:id=item_ak -->
1. all appear in one coherent artifact surface <!-- oc:id=item_al -->
1. no invisible duplicate subsystem or orphan record path <!-- oc:id=item_am -->