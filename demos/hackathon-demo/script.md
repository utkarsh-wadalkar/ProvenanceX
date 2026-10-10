# ProvenanceX — hackathon demo

Real application, isolated local EVM, real Solidity transactions. The existing UI uses Monad Testnet labels/chain ID 10143; the narration explicitly identifies this as a local demonstration. No public-network transactions or explorer links are demonstrated. Approximate timings are refined from the generated voice and local Whisper alignment before filming.

| Time | SAY | SHOW / exact action | Expected result | Focus |
|---|---|---|---|---|
| 0–6s | Media gets shared faster than its source. ProvenanceX gives each file a signed media passport. | Start on settled `/`; move cursor toward Create; click actual Create navigation. | Real homepage and creator route. | Wide hero. |
| 6–12s | This is the real application, running on a local EVM with the Monad contract. | On `/create`, choose bundled Planet No. 04. | Real browser hashing populates SHA-256 and dHash. | Asset preparation and fingerprint rows. |
| 12–18s | Choose a file, declare its source, and fingerprint it in the browser. | Focus `#source-type` and `#tool`; retain synthetic and type `Procedural demo artwork`. | Signed-field preview updates with actual text. | Passport details. |
| 18–27s | Here, procedural artwork is registered as synthetic. That declaration is signed, not guessed by an AI detector. | Navigate via Demo; click Register a real asset; capture actual downloaded passport PNG. | Confirmed local transaction and synthetic declaration. | Declaration panel / receipt. |
| 27–38s | Download the passport PNG, then check that same file. Its canonical SHA-256 hash matches the live registry, while embedded metadata is treated only as a hint. | Upload actual saved PNG through Choose the downloaded passport PNG. | Exact result from real contract lookup and canonical hashing. | Exact integrity result and success text. |
| 38–46s | Now change one pixel. Exact identity fails; image similarity finds the original as a candidate, not proof. | Click Change one pixel. | Actual pixel mutation; no exact match; dHash finds original record. | Modified status / similarity distance. |
| 46–56s | Append an edit event and open the public passport. The browser verifies the complete hash chain against the contract's stored head. | Click Append the derivative, then Open public passport; scroll to HASH-CHAIN HISTORY. | Real append receipt; REGISTERED and DERIVATIVE_EDIT; complete trail verified. | History and trail proof. |
| 56–62s | File identity, source claims, and context stay separate, so people can review before sharing. | Scroll toward record policy and badge, hold final result. | Separate declaration, integrity, signer and sharing guidance. | Final record and badge. |

The artwork is bundled procedural sample content. Any cached local preview uses bytes of the actual downloaded registered PNG, through the same sessionStorage preview path already supported by the app. No fabricated records, RPC interception, API mocks, or substituted UI are permitted.
