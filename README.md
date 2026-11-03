# Afterdark

Afterdark is a browser-based tabletop companion with account-owned character sheets and character-specific gear and cyberware inventories, a searchable item catalog, portrait uploads, and a Node.js server for shared campaign boards, rolls, and life-change events.

Afterdark is unofficial content provided under the Homebrew Content Policy of R. Talsorian Games and is not approved or endorsed by RTG. This content references materials that are the property of R. Talsorian Games and its licensees.

## Run locally

Install dependencies and start the app:

```powershell
npm install
npm start
```

Open <http://localhost:8000> and create an account or sign in. Accounts can create up to 10 characters; character attributes are limited to whole numbers from 0 to 10, and Eddies are limited to 999,999,999. Role/class names are free text. Character sheets, their inventories, account sessions, and the shared custom item catalog are stored by the server in `data/campaign-state.json`. Characters show their initials until a custom portrait is uploaded in the character editor. JPEG, PNG, and WebP uploads up to 2 MB are stored under `data/portraits` and appear on the character sheet and that character's board token. Portraits for characters linked to a shared campaign are visible to its participants. The dashboard lists up to three recently opened character sheets, and its **Friends** panel supports username-based friend requests and direct messages. When creating a campaign, select a friend to send them a direct campaign invite; invite messages contain a link that opens the campaign join form. The main character sheet keeps attributes, limb health, skills, actions, and inventory together. Click an attribute to roll it or a skill to roll its governing attribute plus the skill and any socketed chip bonuses. Inventory categories (Cybernetics, Style, Weapons, Gear) are tabs in the inventory panel; cyberware entries show numeric Humanity loss and an install toggle. Equipped weapons and weapon-capable cyberware appear in Actions. Overall life and limb health can be edited directly on the sheet; armor SP remains editable in the full editor. **Back story** contains character history and notes. The **Search item catalog** button opens a side drawer for name search, category and weapon-type filters, imports, and adding or purchasing items directly for the character.

Campaign details, session notes, unassigned gear, and recently opened sheets are saved in the current browser's local storage. Friend requests, friendships, direct messages, shared campaign boards, room events, and GM ownership are stored on the server. Keep regular backups of both browser data and the server's `data` directory.

## Share a campaign on a trusted local network

Run the server on a computer reachable by the other players:

```powershell
$env:HOST = "0.0.0.0"
npm start
```

Players on the same trusted network open `http://<host-computer-ip>:8000`, create their own accounts, then use **Join shared campaign** and enter the room code supplied by the campaign creator. The account that creates a campaign automatically becomes its game master, and the shared room is initialized when the campaign is created. A campaign card's **Invite** button copies its room code. The creator should open the board while signed in to that account; players leave the optional GM key blank.

Players can share their own characters with the campaign roster. The GM controls adding linked player characters to the board. Players can move their own character tokens, and the GM can move any character token. The server enforces GM-only terrain and enemy placement. A campaign supports up to 10 player accounts, excluding the creator. Character-sheet rolls work without a campaign; when a character is linked to the active campaign, the roll is also posted to the board feed. The GM can make board-side rolls. Players see their own board stats, while the GM can see all board stats; other players' character and enemy stats are withheld.

The server uses account authentication, but this app does not provide HTTPS/TLS or production-grade account recovery. Use it only on a trusted local network; do not expose it directly to the public internet.

## Table rules

New characters can roll nine d10 for their attribute point pool or choose a cinematic pool: Major hero (80), Major supporting character (70), Minor hero (75), Minor support character (60), or Average (50). Every point must be assigned, and each of the nine attributes is capped at 10 during creation. Both allocation totals and the cap are validated by the server. During initial creation, choose exactly nine normal skills and one special skill, assign at least one point to each, and allocate exactly 40 skill points. This ten-skill selection limit only applies during creation; existing characters can add more skills from the editor.

The character sheet lists the full normal and special skill catalogs in attribute-category tabs, so untrained skills can still be rolled at +0. Character skill values are shown and can be extended in the editor after creation. Socketed skill chips add their level as a bonus to matching skill checks and weapon hit rolls; bonuses from multiple matching socketed chips stack. Purchasing a priced chip prompts for a level from 1 to 10 and deducts its total cost from the character's Eddies. Geology is referee-priced, so its purchase form asks for the referee-set price per level. The Daytimer Chip has a fixed catalog price. The supplied chip-price excerpt did not include a page number, so its entries cite the table without inventing one.

Starting Humanity is Empathy × 10. The built-in cyberware and skill-chip catalogs include their Humanity-loss values; skill chips have 0 loss (including Daytimer Chip, whose value was not shown in the supplied table). On first installation, fixed losses are applied directly and dice formulas are rolled in an install prompt. For Kerenzikov Boostware, choose either `1D6` or `2D6`; Interface Plugs roll `1D6` per pair. The rolled loss is saved on the inventory item, so uninstalling and reinstalling does not charge it again, and uninstalling or removing cyberware never restores Humanity. Humanity can be edited in 0.5-point steps for recovery but cannot exceed starting Empathy × 10. Current Empathy is the ceiling of current Humanity divided by 10 and is displayed beside the original score, such as `[7/6]`.

The Overview displays the weapon-action table alongside the character's characteristics and supports configurable skill checks of `1d10 + attribute + natural skill + socketed chip bonuses + modifier` against a target number. Equipped-weapon hit checks use `REF + weapon skill + socketed chip bonuses + 1d10`; the GM adjudicates hits. Clicking a weapon's damage formula rolls it, with the result shown on the sheet; damage is never applied automatically. Attack rows show ammunition and rounds fired. Eddies can be edited on the Overview and are capped at 999,999,999. These checks are available without a campaign; linked character-sheet rolls are also shown in the board feed. Only the GM can make board-side rolls or adjust initiative, terrain, and enemy placements. The server loads the built-in weapon, equipment, cyberware, and skill-chip entries in `catalog/weapon-summaries.json`, `catalog/equipment-summaries.json`, `catalog/cyberware-summaries.json`, and `catalog/skill-chip-summaries.json` automatically at startup; no manual import is needed. Added entries use concise original summaries with a source citation instead of reproduced book descriptions. Custom table entries and CSV/JSON imports remain supported. Catalog records support `weaponType`, `weaponStats`, skill chip prices, and `sourceReference` fields. Name search prioritizes exact matches and otherwise shows partial matches; weapon-type filters are built from the types in the catalog and displayed in a dropdown.
