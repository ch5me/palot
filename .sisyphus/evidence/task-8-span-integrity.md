# Task 8 — Span integrity audit <!-- oc:id=sec_aa -->

## Rule <!-- oc:id=sec_ab -->
No span-bearing entity may bypass shared locator contract.

## Required span-bearing entities <!-- oc:id=sec_ac -->
| Entity | Span field | Contract |
| --- | --- | --- |
| annotation | `locator` | `DocumentLocator` |
| artifact source ref | `locator` | `DocumentLocator` |
| extraction cell provenance | `locators[]` | `DocumentLocator[]` |
| future search hit | `locator` | `DocumentLocator` |
| future chat citation | `locator` | `DocumentLocator` |

## Explicitly forbidden alternatives <!-- oc:id=sec_ad -->
Do not store provenance as:
- raw page number only when exact locator exists
- viewport pixel coordinates
- DOM node ids
- assistant message substring offsets
- unstructured `{ quote, page }` objects outside locator shape
- artifact-local bespoke source blobs

## Why this matters <!-- oc:id=sec_ae -->
If one feature uses a different anchor shape:
- cross-document chat loses consistency
- degraded-state handling forks
- jump-to-source logic duplicates
- native/mobile contract boundary breaks

## Audit verdict <!-- oc:id=sec_af -->
Current proposed domain model keeps all span-bearing fields on shared locator contract. No ad hoc span references remain in planned entities.