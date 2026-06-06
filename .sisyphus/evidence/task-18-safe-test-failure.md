# Task 18 Safe Test Failure <!-- oc:id=sec_aa -->

Failure behavior currently modeled:
- env-missing connections record `Missing env: add required config before probing runtime.`
- failure state renders with warning styling in the Connections page

Diagnostic class is explicit: configuration/env failure rather than generic connect error.