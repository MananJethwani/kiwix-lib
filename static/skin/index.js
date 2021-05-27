(function() {
    const root = $(`link[type='root']`).attr('href');
    let isFetching = false;
    let iso;
    let bookMap = {};
    const incrementalLoadingParams = {
        start: 0,
        count: viewPortToCount()
    };
    let params = new URLSearchParams(window.location.search);
    const filterTypes = ['lang', 'category', 'q'];

    function queryUrlBuilder() {
        let url = `${root}/catalog/search?`;
        url += Object.keys(incrementalLoadingParams).map(key => `${key}=${incrementalLoadingParams[key]}`).join("&");
        return (url + (params.toString() ? `&${params.toString()}` : ''));
    }

    function viewPortToCount(){
        return Math.floor(window.innerHeight/100 + 1)*(window.innerWidth>1000 ? 3 : 2);
    }

    function getInnerHtml(node, query) {
        return node.querySelector(query).innerHTML;
    }

    function generateBookHtml(book, sort = false) {
        const link = book.querySelector('link').getAttribute('href');
        const title =  getInnerHtml(book, 'title');
        const description = getInnerHtml(book, 'summary');
        const linkTag = document.createElement('a');
        const id = getInnerHtml(book, 'id');
        const iconUrl = getInnerHtml(book, 'icon');
        const articleCount = getInnerHtml(book, 'articleCount');
        const mediaCount = getInnerHtml(book, 'mediaCount');
        linkTag.setAttribute('class', 'book');
        linkTag.setAttribute('data-id', id);
        linkTag.setAttribute('href', link);
        if (sort) {
            linkTag.setAttribute('data-idx', bookMap[id]);
        }

        linkTag.innerHTML = `<div class='book__background' style="background-image: url('${iconUrl}');">
            <div class='book__title' title='${title}'>${title}</div>
            <div class='book__description' title='${description}'>${description}</div>
            <div class='book__info'>${articleCount} articles, ${mediaCount} medias</div>
        </div>`;
        return linkTag;
    }

    async function loadBooks() {
        return await fetch(queryUrlBuilder()).then(async (resp) => {
            const data = new window.DOMParser().parseFromString(await resp.text(), 'application/xml');
            const books = data.querySelectorAll('entry');
            books.forEach((book, idx) => {
                bookMap[getInnerHtml(book, 'id')] = idx;
            });
            incrementalLoadingParams.start += books.length;
            if (books.length < incrementalLoadingParams.count) {
                incrementalLoadingParams.count = 0;
    }
            return books;
        });
    }

    async function loadAndDisplayOptions(nodeQuery, query) {
        // currently taking an array in place of query, will replace it with query while fetching data from backend later on.
        await fetch(query)
        .then(async (resp) => {
            const data = await resp.json();
            Object.keys(data).forEach((option) => {
                document.querySelector(nodeQuery).innerHTML += `<option value='${option}'>${data[option]}</option>`;
            });
        });
    }

    async function loadAndDisplayBooks(sort = false) {
        if (isFetching) return;
        isFetching = true;
        let books = await loadBooks();
        const booksToFilter = new Set();
        const booksToDelete = new Set();
        iso.arrange({
            filter: function (idx, elem) {
                const id = elem.getAttribute('data-id');
                const retVal = bookMap.hasOwnProperty(id);
                if (retVal) {
                    booksToFilter.add(id);
                    if (sort) {
                        elem.setAttribute('data-idx', bookMap[id]);
                        iso.updateSortData(elem);
                    }
                } else {
                    booksToDelete.add(elem);
                }
                return retVal;
            }
        });
        books = [...books].filter((book) => {return !booksToFilter.has(getInnerHtml(book, 'id'))});
        booksToDelete.forEach(book => {iso.remove(book);});
        books.forEach((book) => {iso.insert(generateBookHtml(book, sort))});
        isFetching = false;
    }

    async function filterBooks(filterType, filterValue) {
        isFetching = false;
        incrementalLoadingParams.start = 0;
        incrementalLoadingParams.count = viewPortToCount();
        bookMap = {};
        params = new URLSearchParams(window.location.search);
        if (!filterValue) {
            params.delete(filterType);
        } else {
            params.set(filterType, filterValue);
        }
        window.history.pushState({}, null, `${window.location.href.split('?')[0]}?${params.toString()}`);
        await loadAndDisplayBooks(true);
    }

    window.addEventListener('popstate', async () => {
        bookMap = {};
        isFetching = false;
        incrementalLoadingParams.start = 0;
        incrementalLoadingParams.count = viewPortToCount();
        params = new URLSearchParams(window.location.search);
        filterTypes.forEach(key => {document.getElementsByName(key)[0].value = params.get(key) || ''});
        loadAndDisplayBooks(true);
    });

    async function loadSubset() {
        if (incrementalLoadingParams.count && window.innerHeight + window.scrollY >= document.body.offsetHeight) {
            loadAndDisplayBooks();
        }
    }

    window.addEventListener('resize', async () => {
        incrementalLoadingParams.count = incrementalLoadingParams.count && viewPortToCount();
        loadSubset();
    });

    window.addEventListener('scroll', loadSubset);

    window.onload = async () => {
            iso = new Isotope( '.book__list', {
                itemSelector: '.book',
                getSortData:{
                    weight: function( itemElem ) {
                        const index = itemElem.getAttribute('data-idx');
                        return index ? parseInt(index) : Infinity;
                    }
                },
                sortBy: 'weight'
        });
        loadAndDisplayBooks();
        loadAndDisplayOptions('#languageFilter', `${root}/skin/langList.json`);
        loadAndDisplayOptions('#categoryFilter', `${root}/skin/categoryList.json`);
        for (const key of params.keys()) {
            document.getElementsByName(key)[0].value = params.get(key);
        }
        filterTypes.forEach((filter) => {
            const filterTag = document.getElementsByName(filter)[0];
            filterTag.addEventListener('change', () => {filterBooks(filterTag.name, filterTag.value)});
        });
        document.getElementById('kiwixSearchForm').onsubmit = (event) => {event.preventDefault()}
    }
})();
