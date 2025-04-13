const API_BASE_URL = '';
const TMDB_API_KEY = 'b572fdadce93fd096624678e4b0d7f1f'; 

const movieInput = document.getElementById('movieInput');
const searchBtn = document.getElementById('searchBtn');
const suggestionsDiv = document.getElementById('suggestions');
const resultsDiv = document.getElementById('results');
const loadingDiv = document.getElementById('loading');

searchBtn.addEventListener('click', getRecommendations);
movieInput.addEventListener('input', debounce(searchTitleSuggestions, 300));
movieInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') getRecommendations();
});

function debounce(func, timeout = 300) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => { func.apply(this, args); }, timeout);
    };
}

async function searchTitleSuggestions() {
    const query = movieInput.value.trim();
    if (query.length < 3) {
        suggestionsDiv.innerHTML = '';
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/search-titles/${encodeURIComponent(query)}`);
        const data = await response.json();
        
        if (data.matches && data.matches.length > 0) {
            suggestionsDiv.innerHTML = data.matches.map(movie => 
                `<span class="suggestion-item" onclick="useSuggestion('${movie.replace("'", "\\'")}')">${movie}</span>`
            ).join('');
        } else {
            suggestionsDiv.innerHTML = '<span class="text-muted">No matches found</span>';
        }
    } catch (error) {
        console.error('Suggestion error:', error);
    }
}

function useSuggestion(title) {
    movieInput.value = title;
    suggestionsDiv.innerHTML = '';
    getRecommendations();
}

async function getRecommendations() {
    const title = movieInput.value.trim();
    if (!title) return;
    
    loadingDiv.classList.remove('d-none');
    resultsDiv.innerHTML = '';
    suggestionsDiv.innerHTML = '';
    
    try {
        const response = await fetch(`${API_BASE_URL}/recommend/${encodeURIComponent(title)}`);
        const data = await response.json();
        
        if (data.error) {
            showError(data.error, data.suggestions);
            return;
        }
        
        await displayRecommendations(data.recommendations);
        
    } catch (error) {
        console.error('Fetch error:', error);
        showError(error.message);
    } finally {
        loadingDiv.classList.add('d-none');
    }
}

async function displayRecommendations(movies) {
    resultsDiv.innerHTML = '';
    
    for (const movie of movies) {
        try {
            const tmdbData = await fetchTMDBData(movie);
            createMovieCard(movie, tmdbData);
        } catch (error) {
            console.error(`Error processing ${movie}:`, error);
            createMovieCard(movie, null);
        }
    }
}

async function fetchTMDBData(movieTitle) {
    const url = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(movieTitle)}`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.results && data.results.length > 0) {
        const movie = data.results[0];
        return {
            poster: movie.poster_path 
                ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
                : null,
            rating: movie.vote_average,
            overview: movie.overview
        };
    }
    return { poster: null, rating: null, overview: null };
}

function createMovieCard(movie, tmdbData) {
    const colDiv = document.createElement('div');
    colDiv.className = 'col-md-4 mb-4';
    
    colDiv.innerHTML = `
        <div class="card movie-card h-100">
            <img 
                src="${tmdbData?.poster || 'https://via.placeholder.com/300x450?text=No+Poster'}" 
                class="card-img-top poster" 
                alt="${movie}"
                onerror="this.src='https://via.placeholder.com/300x450?text=Poster+Not+Available'"
            >
            <div class="card-body">
                <h5 class="card-title">${movie}</h5>
                ${tmdbData?.rating ? `<p class="text-muted">Rating: ${tmdbData.rating}/10</p>` : ''}
                ${tmdbData?.overview ? `<p class="card-text">${tmdbData.overview.substring(0, 100)}...</p>` : ''}
            </div>
        </div>
    `;
    
    resultsDiv.appendChild(colDiv);
}

function showError(message, suggestions = []) {
    let html = `
        <div class="alert alert-danger">
            ${message}
        </div>
    `;
    
    if (suggestions.length > 0) {
        html += `
            <div class="mt-3">
                <p>Did you mean:</p>
                <div class="d-flex flex-wrap gap-2">
                    ${suggestions.map(s => 
                        `<button class="btn btn-outline-primary btn-sm" 
                         onclick="movieInput.value='${s.replace("'", "\\'")}';getRecommendations()">
                            ${s}
                        </button>`
                    ).join('')}
                </div>
            </div>
        `;
    }
    
    resultsDiv.innerHTML = html;
}