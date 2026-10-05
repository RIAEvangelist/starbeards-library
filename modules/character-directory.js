// This library owns its fictional cast, story references and profile presentation.
export function createCharacterDirectory(books) {
    const view = document.querySelector('#character-view');
    const directory = document.querySelector('#character-directory');
    const profile = document.querySelector('#character-profile');
    const scroller = document.querySelector('#character-scroll');
    const grid = document.querySelector('#character-grid');
    const search = document.querySelector('#character-search');
    const storyFilter = document.querySelector('#character-story');
    const count = document.querySelector('#character-count');
    const retry = document.querySelector('#character-retry');
    const controller = new AbortController();
    const sources = ['core', 'early-supporting', 'origins', 'later-supporting'];
    let characters = null;
    let loading = null;
    let selectedId = '';
    let directoryScroll = 0;

    for (const [id, book] of Object.entries(books)) {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = book.title;
        storyFilter.append(option);
    }

    function textElement(tag, text, className) {
        const element = document.createElement(tag);
        element.textContent = text;
        if (className) element.className = className;
        return element;
    }

    function characterImage(character, className) {
        if (!character.image) {
            const symbol = textElement('div', '✦', className + ' character-symbol');
            symbol.setAttribute('aria-hidden', 'true');
            return symbol;
        }
        const image = document.createElement('img');
        image.className = className;
        image.src = character.image;
        image.alt = character.imageAlt;
        image.loading = 'lazy';
        image.style.objectPosition = character.imagePosition || 'center';
        return image;
    }

    function renderCards() {
        if (!characters) return;
        const query = search.value.toLocaleLowerCase().trim();
        const fragment = document.createDocumentFragment();
        let visible = 0;
        for (const character of characters) {
            const matchesStory = !storyFilter.value || character.storyIds.includes(storyFilter.value);
            const searchable = [character.name, character.role, character.summary, ...(character.aliases || []), ...character.established, ...character.backstory].join(' ').toLocaleLowerCase();
            if (!matchesStory || (query && !searchable.includes(query))) continue;
            const card = document.createElement('a');
            card.className = 'character-card';
            card.href = '#character/' + character.id;
            card.append(characterImage(character, 'character-card-image'));
            const copy = document.createElement('div');
            copy.className = 'character-card-copy';
            copy.append(textElement('p', character.role, 'character-eyebrow'));
            copy.append(textElement('h2', character.name));
            copy.append(textElement('p', character.summary));
            copy.append(textElement('span', 'Meet ' + character.name + ' →', 'character-card-cta'));
            card.append(copy);
            fragment.append(card);
            visible += 1;
        }
        grid.replaceChildren(fragment);
        count.textContent = visible
            ? visible + ' character and community ' + (visible === 1 ? 'profile' : 'profiles') + (storyFilter.value ? ' in this story' : ' across the library')
            : 'No characters found. Try another name or choose a different story.';
    }

    function paragraphSection(title, paragraphs, className) {
        const section = document.createElement('section');
        section.className = className || '';
        section.append(textElement('h2', title));
        for (const paragraph of paragraphs) section.append(textElement('p', paragraph));
        return section;
    }

    function renderProfile() {
        const character = characters.find(function findCharacter(record) {
            return record.id === selectedId;
        });
        profile.replaceChildren();
        const back = textElement('a', '← All characters', 'character-text-link');
        back.href = '#characters';
        profile.append(back);
        if (!character) {
            const title = textElement('h1', 'That character is still beyond our map.');
            title.id = 'character-profile-title';
            title.tabIndex = -1;
            profile.append(title, textElement('p', 'Choose a character from the field guide to keep exploring.'));
            return;
        }
        document.title = character.name + ' | Starbeard’s field guide';
        const header = document.createElement('header');
        header.className = 'character-profile-heading';
        header.append(textElement('p', character.role, 'character-eyebrow'));
        const title = textElement('h1', character.name);
        title.id = 'character-profile-title';
        title.tabIndex = -1;
        header.append(title, textElement('p', character.summary, 'character-profile-dek'));
        profile.append(header);
        const columns = document.createElement('div');
        columns.className = 'character-profile-columns';
        const prose = document.createElement('div');
        prose.className = 'character-prose';
        prose.append(paragraphSection('In the stories', character.established));
        const backstory = paragraphSection('Beyond the pages', character.backstory, 'character-backstory');
        backstory.insertBefore(textElement('p', 'New backstory from the shared story world', 'character-eyebrow'), backstory.firstChild);
        prose.append(backstory);
        const aside = document.createElement('aside');
        aside.className = 'character-profile-aside';
        const figure = document.createElement('figure');
        figure.append(characterImage(character, 'character-profile-image'));
        figure.append(textElement('figcaption', character.image ? 'An illustration from the stories' : 'This character’s appearance is still open to imagination.'));
        aside.append(figure);
        aside.append(paragraphSection('Look closely', [character.appearance]));
        if (character.relationships.length) {
            const relationships = document.createElement('section');
            relationships.append(textElement('h2', 'Their circle'));
            const list = document.createElement('dl');
            for (const relationship of character.relationships) {
                const related = characters.find(function matchRelated(record) {
                    return record.name === relationship.name || record.aliases?.includes(relationship.name);
                });
                const term = document.createElement('dt');
                if (related) {
                    const link = textElement('a', relationship.name);
                    link.href = '#character/' + related.id;
                    term.append(link);
                } else term.textContent = relationship.name;
                list.append(term, textElement('dd', relationship.detail));
            }
            relationships.append(list);
            aside.append(relationships);
        }
        const storyLinks = document.createElement('section');
        storyLinks.className = 'character-story-links';
        storyLinks.append(textElement('h2', 'Follow their adventures'));
        for (const storyId of character.storyIds) {
            const link = textElement('a', books[storyId].title + ' →');
            link.href = '#book/' + storyId;
            storyLinks.append(link);
        }
        prose.append(storyLinks);
        const references = document.createElement('details');
        references.className = 'character-references';
        references.append(textElement('summary', 'Story references & continuity'));
        const referenceList = document.createElement('ul');
        for (const source of character.sources) {
            const item = document.createElement('li');
            const link = textElement('a', books[source.storyId].title + ' — ' + source.location);
            link.href = '#book/' + source.storyId;
            item.append(link);
            referenceList.append(item);
        }
        references.append(referenceList);
        for (const note of character.notes) references.append(textElement('p', note));
        prose.append(references);
        columns.append(prose, aside);
        profile.append(columns);
    }

    function renderSelection() {
        directory.hidden = Boolean(selectedId);
        profile.hidden = !selectedId;
        if (selectedId) {
            renderProfile();
            scroller.scrollTop = 0;
            profile.querySelector('h1').focus({ preventScroll: true });
        } else {
            document.title = 'Meet the characters | Starbeard’s Library';
            renderCards();
            scroller.scrollTop = directoryScroll;
            document.querySelector('#character-directory-title').focus({ preventScroll: true });
        }
    }

    async function readCastFile(name) {
        const response = await fetch('./manuscripts/canon/' + name + '.json', { signal: controller.signal });
        if (!response.ok) throw new Error('Character source unavailable: ' + name + ' (' + response.status + ')');
        return response.json();
    }

    async function loadCharacters() {
        if (loading) return loading;
        directory.hidden = false;
        profile.hidden = true;
        count.textContent = 'Opening the field guide…';
        retry.hidden = true;
        loading = Promise.all(sources.map(readCastFile)).then(function storeCharacters(groups) {
            characters = groups.flat();
            if (!view.hidden) renderSelection();
        }).catch(function showCharacterLoadError(error) {
            if (error.name === 'AbortError') return;
            console.error(error);
            count.textContent = 'The field guide could not open. Your books are still available in the library.';
            retry.hidden = false;
        }).finally(function finishLoadingCharacters() {
            loading = null;
        });
        return loading;
    }

    function show(hash) {
        if (!directory.hidden && !view.hidden) directoryScroll = scroller.scrollTop;
        selectedId = hash.startsWith('#character/') ? hash.substring('#character/'.length) : '';
        view.hidden = false;
        document.body.classList.add('is-characters');
        if (characters) renderSelection();
        else loadCharacters();
    }

    function hide() {
        if (!view.hidden && !directory.hidden) directoryScroll = scroller.scrollTop;
        view.hidden = true;
        document.body.classList.remove('is-characters');
    }

    function resetFilters(event) {
        event.preventDefault();
        search.value = '';
        storyFilter.value = '';
        renderCards();
    }

    function preventSearchNavigation(event) {
        event.preventDefault();
    }

    function stopCharacterLoad(event) {
        if (!event.persisted) controller.abort();
    }

    search.addEventListener('input', renderCards);
    storyFilter.addEventListener('change', renderCards);
    document.querySelector('#character-filters').addEventListener('reset', resetFilters);
    document.querySelector('#character-filters').addEventListener('submit', preventSearchNavigation);
    retry.addEventListener('click', loadCharacters);
    window.addEventListener('pagehide', stopCharacterLoad);
    return { show, hide };
}
