export function renderCharacters({ workspace, signedInAccount, maxCharacters, characterCard, emptyState, demoBanner }) {
  const createButton = document.querySelector('#view-characters [data-new="character"]');
  if (createButton) {
    const atLimit = Boolean(signedInAccount && workspace.characters.length >= maxCharacters);
    createButton.disabled = atLimit;
    createButton.title = atLimit ? `This account has reached its ${maxCharacters}-character limit.` : "";
  }
  const content = workspace.characters.length
    ? `<div class="section-head"><div><p class="section-kicker">ROSTER</p><h2>${workspace.characters.length} ${workspace.characters.length === 1 ? "character" : "characters"}</h2><p class="page-subtitle">${signedInAccount ? `${workspace.characters.length}/${maxCharacters} characters used on this account.` : "Sign in to create, own, and sync characters."}</p></div></div><div class="character-grid">${workspace.characters.map(characterCard).join("")}</div>`
    : emptyState("ROSTER EMPTY", "A blank page in a loud city.", "Create a character to keep attributes, skills, notes, and history in one place.", "Create a character", "character");
  document.getElementById("characters-content").innerHTML = `${demoBanner()}${content}`;
}
