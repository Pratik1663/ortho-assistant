# Release acceptance cases

Use synthetic, non-identifying cases and record the model, date, response transcript, token use, and result. These are software acceptance criteria, not prescribing guidance. A practitioner must assess the appropriateness of the suggested build.

| Case | Expected behaviour |
| --- | --- |
| Thorough approved charting | Proposes a complete sixteen-field draft without asking for information already supplied. |
| Sparse presentation | Asks up to three material clinical questions together; does not interview about cover colour/material selections. |
| Forefoot complaint, then a separate heel complaint | Reasoning and relevant questions change with the complaint; no recycled generic plan. |
| Explicit right-only device | All left fields show None from the first snapshot; no left device is silently added. |
| One-sided pain without a device-side instruction | Explains its laterality assumption rather than treating pain side as an order. |
| Prominent navicular answer | May suggest an accommodation, but does not call that finding an order or acceptance. |
| Practitioner adds two modifications or removes one | Retains the explicit choices; explains a concern briefly if relevant; does not silently drop or reinstate them. |
| Missing numeric posting/skive value | Does not invent a measurement. Essential unknown remains open; otherwise proposes none with context. |
| Neutral post and zero skive | Keeps 0° neutral posting as a device instruction and records 0mm skive as none. |
| Full proposal | Key recommendation values are bold, every field is represented and the panel says Suggested prescription. |
| Accept prescription | Exact displayed values appear in a complete confirmed summary; there is no additional API call. |
| Change right heel cup after acceptance | Left value stays unchanged, review reopens, and previous SOAP/documents are cleared. |
| Click a differing row versus a side cell | Row badge and edits both apply to both feet; cell badge and edits apply only to the selected side. Repeat with keyboard. |
| Interrupted response or output limit | Retry message appears; incomplete/stale proposal cannot be accepted or used for SOAP. |
| Complete build with a flagged value or one open side | Acceptance stays disabled until resolved. |
| SOAP after acceptance | Device values exactly match the confirmed snapshot; assessment and diagnosis contain only supplied practitioner statements. |
| Edit approved charting | Downstream approval is withdrawn and an accepted prescription requires review against the changed source. |
| Reload/browser backup restore | Records load; existing acceptance and stricter parser behave as documented. Historical documents require review. |
| Mobile layout and 200% text enlargement | Both feet, acceptance status, controls, composer and errors remain readable and operable. |
| Uploaded clinic form | Existing text transcription behaviour remains; do not claim original-layout PDF filling. |

Do not release solely on the mocked tests. Run the live proposal cases repeatedly to distinguish prompt regressions from response variation. Before clinic rollout, complete the authentication/storage work described in the handover.
