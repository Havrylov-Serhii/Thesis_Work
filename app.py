from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware

import joblib
import numpy as np
import pandas as pd

import re
import unicodedata

from difflib import get_close_matches

app = FastAPI()

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

def normalize_title(title: str) -> str:
    """Normalize movie titles for consistent matching"""
    title = unicodedata.normalize('NFKD', title)
    title = re.sub(r'[^\w\s-]', '', title.lower())  
    return title.strip()

def load_assets():
    try:
        tfidf = joblib.load('model/tfidf_vectorizer.pkl')
        cosine_sim = np.load('model/cosine_sim.npy')
        df = pd.read_csv('data/movie_metadata.csv')
        
        # Create normalized index
        df['normalized_title'] = df['original_title'].apply(normalize_title)
        indices = pd.Series(df.index, index=df['normalized_title']).drop_duplicates()
        
        return tfidf, cosine_sim, df, indices
    except Exception as e:
        raise RuntimeError(f"Failed to load assets: {str(e)}")

try:
    tfidf, cosine_sim, df, indices = load_assets()
except RuntimeError as e:
    print(f"Fatal error: {e}")
    exit(1)

@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/recommend/{title}")
async def get_recommendations(title: str, top_n: int = 5):
    try:
        clean_title = normalize_title(title)
        
        if clean_title not in indices:
            suggestions = get_close_matches(clean_title, indices.index, n=3, cutoff=0.6)
            raise HTTPException(
                status_code=404,
                detail={
                    "error": "Movie not found",
                    "suggestions": suggestions,
                    "input_title": title
                }
            )
            
        idx = indices[clean_title]
        sim_scores = list(enumerate(cosine_sim[idx]))
        sim_scores = sorted(sim_scores, key=lambda x: x[1], reverse=True)[1:top_n+1]
        recommendations = df['original_title'].iloc[[i[0] for i in sim_scores]].tolist()
        
        return {
            "input_title": title,
            "recommendations": recommendations
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/search-titles/{query}")
async def search_titles(query: str):
    clean_query = normalize_title(query)
    matches = [title for title in df['original_title'] if clean_query in normalize_title(title)]
    return {"matches": matches[:10]} 

