# System podpisów cyfrowych dla dokumentów PDF

Nowoczesna aplikacja webowa do podpisywania i weryfikacji dokumentów PDF z wykorzystaniem kryptografii asymetrycznej (RSA-PSS), kontroli dostępu opartej o role oraz pełnej ścieżki audytowej podpisów.

## Spis treści
- Opis projektu
- Kluczowe funkcjonalności
- Architektura i stos technologiczny
- Struktura projektu
- Szybki start (lokalnie)
- Konfiguracja środowiska
- Jak używać aplikacji
- Najważniejsze endpointy API
- Bezpieczeństwo

## Opis projektu

System umożliwia:
- rejestrację i logowanie użytkowników,
- generowanie par kluczy kryptograficznych po stronie przeglądarki,
- podpisywanie plików PDF wraz z metadanymi podpisu,
- zapis podpisanych dokumentów oraz danych podpisu w bazie,
- weryfikację poprawności podpisu,
- administracyjne zarządzanie podpisanymi dokumentami.

Projekt został podzielony na dwa moduły:
- Backend: FastAPI + SQLAlchemy + SQLite,
- Frontend: React + TypeScript + Vite.

## Kluczowe funkcjonalności

### Dla użytkownika
- Rejestracja i logowanie z użyciem JWT.
- Generowanie kluczy RSA-PSS w przeglądarce (Web Crypto API).
- Podpisywanie dokumentu PDF z metadanymi (np. podpisujący, lokalizacja, cel).
- Lista podpisanych dokumentów i pobieranie gotowego PDF.

### Dla administratora
- Weryfikacja podpisu dokumentu PDF.
- Pobieranie klucza publicznego dla wybranego podpisu.
- Podgląd danych podpisów i zarządzanie dokumentami.

## Architektura i stos technologiczny

### Backend
- FastAPI
- SQLAlchemy
- SQLite
- PyPDF2
- python-jose (JWT)
- bcrypt / passlib (hashowanie haseł)

### Frontend
- React 18
- TypeScript
- Vite
- React Router
- Axios

### Kryptografia
- Algorytm podpisu: RSA-PSS
- Funkcja skrótu: SHA-256
- Format klucza publicznego: JWK (JSON Web Key)

## Struktura projektu

```text
System-podpisow-cyfrowych-dla-dokumentow-PDF/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── auth.py
│   │   ├── database.py
│   │   ├── routes/
│   │   │   ├── auth_routes.py
│   │   │   ├── signature_routes.py
│   │   │   └── admin_routes.py
│   │   └── services/
│   │       ├── crypto_service.py
│   │       └── pdf_service.py
│   ├── requirements.txt
│   ├── data/
│   └── signed_pdfs/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   └── services/
│   ├── package.json
│   └── vite.config.ts
└── README.md
```

## Szybki start (lokalnie)

### Wymagania
- Python 3.10+
- Node.js 18+
- npm

### 1. Uruchom backend

Windows (PowerShell):

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Linux/macOS:

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Backend będzie dostępny pod adresem:
- API: http://localhost:8000
- Swagger: http://localhost:8000/docs

### 2. Uruchom frontend

W nowym terminalu:

```bash
cd frontend
npm install
npm run dev
```

Frontend będzie dostępny pod adresem:
- http://localhost:5173

## Konfiguracja środowiska

Aktualnie frontend korzysta domyślnie z:
- http://localhost:8000/api

W razie wdrożenia produkcyjnego zaktualizuj adres API w plikach:
- frontend/src/services/apiService.ts
- frontend/src/services/authService.ts

## Jak używać aplikacji

1. Otwórz aplikację frontendową pod adresem http://localhost:5173.
2. Załóż konto lub zaloguj się.
3. Użytkownik (rola user): przejdź do panelu podpisywania dokumentu.
4. Wygeneruj parę kluczy kryptograficznych.
5. Wgraj PDF, uzupełnij metadane i podpisz dokument.
6. Administrator (rola admin): przejdź do panelu weryfikacji.
7. Zweryfikuj podpis i pobierz klucz publiczny, jeśli potrzebny.

## Najważniejsze endpointy API

Prefiks: /api

### Uwierzytelnianie
- POST /auth/register
- POST /auth/token
- GET /auth/me

### Podpisy
- POST /signature/prepare-signature-with-metadata
- POST /signature/embed-signature-to-db
- POST /signature/verify-signature
- GET /signature/signed-pdfs
- GET /signature/download-signed-pdf/{signature_id}
- GET /signature/download-public-key/{signature_id}

### Administracja
- GET /admin/signatures
- GET /admin/signatures/{signature_id}
- GET /admin/database/info
- GET /admin/documents
- DELETE /admin/signatures/{signature_id}
- DELETE /admin/documents/{document_id}

## Bezpieczeństwo

- Hasła użytkowników są haszowane algorytmem bcrypt.
- Autoryzacja oparta jest o tokeny JWT.
- Podpis realizowany jest przez RSA-PSS z SHA-256.
- Klucze prywatne generowane i przechowywane są po stronie klienta (sessionStorage).

Wskazówka dla środowiska produkcyjnego:
- przenieś SECRET_KEY do zmiennych środowiskowych,
- ogranicz CORS do docelowych domen,
- wymuś HTTPS i regularną rotację sekretów.

## Autorzy

Projekt zespołowy PAI.

## Licencja

Do uzupełnienia (np. MIT).
