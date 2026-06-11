# Task 12 Evidence — Recent Ordering <!-- oc:id=sec_aa -->

Updated code:
- `apps/desktop/src/renderer/components/sidebar.tsx`

Behavior:
- recent ordering continues to use canonical `lastActiveAt`
- active ordering now also uses canonical `lastActiveAt`, removing old `createdAt` bias

Result:
- sidebar ordering better matches canonical activity semantics across active and recent buckets