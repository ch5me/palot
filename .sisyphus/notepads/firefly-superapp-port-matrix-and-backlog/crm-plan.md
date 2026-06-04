# Contacts / CRM Plan <!-- oc:id=sec_aa -->

## Current repo reality <!-- oc:id=sec_ab -->

- No existing CRM or contacts domain appears in renderer or main process.
- No contact-specific backend seam exists today.
- Bridges already establishes an integrations-oriented hub where contact sources could later attach.

## Decision <!-- oc:id=sec_ac -->

Contacts and CRM should stay one surface for now.

## Why <!-- oc:id=sec_ad -->

- There is no existing domain logic to justify splitting them yet.
- A single shell can prove whether this belongs in Palot without inventing separate contact vs pipeline products.
- If future vendor integrations (email, messaging, CRM APIs) arrive, the split can happen later from a known shell.

## First shell shape <!-- oc:id=sec_ae -->

- Add a `crm` Firefly side-panel surface.
- Treat it as a contacts + relationship context surface.
- Start with placeholder sections for people, recent relationship context, and next-action notes.
- Defer real sync/domain logic until an actual connector/data source exists.

## Domain logic decision <!-- oc:id=sec_af -->

Do not port `src/lib/crm.ts` yet.

Reason:
- There is no corresponding backend or data source in Palot now.
- Domain-first porting would be speculative.
- The shell should land first and create the seam where real CRM/contact integrations can attach later.