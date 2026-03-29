from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routes import signature_routes, admin_routes, auth_routes
from .database import init_db

app = FastAPI(
    title="PDF Signature System API",
    description="System podpisów cyfrowych dla PDF z autentykacją",
    version="2.0.0"
)

# ===== POPRAWIONE CORS =====
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
        "https://projekt-pai-sable.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],  # Zezwala na wszystkie metody (GET, POST, PUT, DELETE, etc.)
    allow_headers=["*"],  # Zezwala na wszystkie nagłówki
    expose_headers=["*"],
    max_age=3600,
)

# Inicjalizuj bazę
init_db()

# Routes
app.include_router(auth_routes.router, prefix="/api")
app.include_router(signature_routes.router, prefix="/api")
app.include_router(admin_routes.router, prefix="/api")

@app.get("/")
async def root():
    return {
        "message": "PDF Signature System API v2.0", 
        "status": "running",
        "docs": "/docs"
    }

@app.get("/health")
async def health():
    return {
        "status": "healthy", 
        "database": "connected", 
        "auth": "enabled",
        "cors": "configured"
    }
