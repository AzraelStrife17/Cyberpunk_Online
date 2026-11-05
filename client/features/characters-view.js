export function renderCharacters({ workspace, signedInAccount, maxCharacters, characterCard, emptyState, demoBanner }) {
  const createButton = document.querySelector('#view-characters [data-new="character"]');
  const playerCharacters = workspace.characters.filter(character => !character.isNpc);
  const npcCharacters = workspace.characters.filter(character => character.isNpc);
  if (createButton) {
    const atLimit = Boolean(signedInAccount && playerCharacters.length >= maxCharacters);
    createButton.disabled = atLimit;
    createButton.title = atLimit ? `This account has reached its ${maxCharacters}-character limit.` : "";
  }
  const content = `<section class="character-roster-section"><div class="section-head"><div><p class="section-kicker">PLAYER ROSTER</p><h2>${playerCharacters.length} ${playerCharacters.length === 1 ? "character" : "characters"}</h2><p class="page-subtitle">${signedInAccount ? `${playerCharacters.length}/${maxCharacters} player characters used on this account.` : "Sign in to create, own, and sync characters."}</p></div></div>${playerCharacters.length ? `<div class="character-grid">${playerCharacters.map(characterCard).join("")}</div>` : emptyState("ROSTER EMPTY", "A blank page in a loud city.", "Create a character to keep attributes, skills, notes, and history in one place.", "Create a character", "character")}</section>
    <section class="character-roster-section"><div class="section-head"><div><p class="section-kicker">NON-PLAYER CHARACTERS</p><h2>${npcCharacters.length} ${npcCharacters.length === 1 ? "NPC" : "NPCs"}</h2><p class="page-subtitle">Create supporting characters, adversaries, and large units with custom board footprints.</p></div><button class="button button-primary" type="button" data-new="npc">＋ Create NPC</button></div>${npcCharacters.length ? `<div class="character-grid">${npcCharacters.map(characterCard).join("")}</div>` : `<p class="field-hint">No NPCs created yet. NPCs can use any total skill points and can be sized for the tactical board.</p>`}</section>`;
  document.getElementById("characters-content").innerHTML = `${demoBanner()}${content}`;
}
