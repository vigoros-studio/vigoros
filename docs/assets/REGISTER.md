# Asset provenance register

Every third-party file under `apps/hq/public/models/` is listed here with where it came from, who made it, the licence text that shipped with it, and the version. Nothing was purchased. Nothing here is from a marketplace mirror; each pack was taken from the publisher's own distribution.

Scale convention: the HQ is in metres (a desk top is 0.74 m high, a seat 0.45 m). Authored packs are scaled on import to match; the factor is recorded per pack and applied in code, never baked into the files.

Material convention: imported models are re-materialised to the HQ palette (`components/hq/v2/materials.ts`). Palette-atlas packs get a generated atlas in our colours; flat-colour packs get their material colours remapped by name. The original files are kept unmodified so the mapping stays reversible.

| Pack | Creator | Source (publisher's own) | Licence (as shipped) | Version / date | Files taken | Scale on import |
|---|---|---|---|---|---|---|
| KayKit Furniture Bits | Kay Lousberg (kaylousberg.com) | github.com/KayKit-Game-Assets/KayKit-Furniture-Bits-1.0, branch `main`, commit `96d5930a8dbdb363409bbc2d3341718b00e17c9c` (2023-09-16) | CC0 1.0 Universal, `LICENSE.txt` in the pack ("This content is free to use in personal, educational and commercial projects"; credit optional) | 1.0, created 2023-09-08 | 23 of 53 glTF models + `.bin` + `furniturebits_texture.png` + `LICENSE.txt` → `apps/hq/public/models/kaykit-furniture-bits/` | 0.75 (a 1.0-unit table top becomes 0.75 m) |
| Ultimate Modular Men Pack | Quaternius (quaternius.com) | quaternius.com/packs/ultimatemodularcharacters.html → publisher's Google Drive folder `1USAAquX2JJWuA2m6zol0KUkFe3UkZ8zX`, `Individual Characters/glTF/` | CC0 1.0 Universal, `License.txt` in the Drive folder ("Ultimate Modular Males by @Quaternius … CC0 1.0 Universal Public Domain Dedication") | February 2022 release; glTF exported with Blender I/O 1.7.33 | `Casual_Hoodie.gltf`, `Casual_2.gltf`, `Suit.gltf` (embedded buffers), repacked losslessly as `.glb` → `apps/hq/public/models/quaternius-modular/men_*.glb`; `LICENSE-men.txt` | see code (`RiggedWriter.tsx`) |
| Ultimate Modular Women Pack | Quaternius (quaternius.com) | quaternius.com/packs/ultimatemodularwomen.html → publisher's Google Drive folder `1720N9IGyQHXYvtvZJzazhxtTTlz-y2Vf`, `Individual Characters/glTF/` | CC0 1.0 Universal, `License.txt` in the Drive folder | February 2022 release; glTF exported with Blender I/O 1.7.33 | `Casual.gltf`, `Formal.gltf`, `Suit.gltf` repacked as `.glb` → `apps/hq/public/models/quaternius-modular/women_*.glb`; `LICENSE-women.txt` | see code |

## Licence note on Quaternius

The pack pages and the `License.txt` files shipped inside the packs state CC0 1.0. The site's general licence page (quaternius.com/license.html) now describes a "Quaternius Asset License v1.0" that forbids redistributing the assets as standalone files. CC0 is irrevocable for the files released under it, and the files here are used inside the product, not redistributed on their own. The repository is private. If it is ever made public, the three character files should be moved out of the repository into a release bucket to stay clearly inside the stricter reading.

## Evaluated and not taken

| Pack | Why not |
|---|---|
| Quaternius Universal Base Characters (itch.io) | Free tier has 2 base bodies and 5 hairstyles with no clothing; dressing them needs Blender, which is not installed on the build machine. Best upgrade path for the characters once Blender is in the pipeline (13k tris, humanoid rig, 20 hairstyles, CC0). |
| Quaternius Universal Animation Library (itch.io) | 45 free clips including sitting; same rig family as above. Not needed until the base characters are. |
| Quaternius Ultimate Furniture Pack (2019) | 20 home models (beds, chairs, tables), untextured, no office pieces. KayKit covers the same ground better. |
| KayKit Adventurers / Skeletons | Fantasy characters; wrong register for an office. |
| Mixamo | Needs an Adobe login and a browser session per clip; cannot be automated and its licence is Adobe's, not CC0. |
| Synty | Paid; needs the founder's permission before purchase. |
