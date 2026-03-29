from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from PyPDF2 import PdfReader
import json
import os
import tempfile
import hashlib
import base64
import shutil
import io
from datetime import datetime
from pathlib import Path

from ..database import get_db, Signature, User
from ..services import crypto_service
from ..services.pdf_service import PdfService
from ..auth import get_current_user

router = APIRouter(prefix="/signature", tags=["signature"])

SIGNED_PDF_DIR = Path("signed_pdfs")
SIGNED_PDF_DIR.mkdir(exist_ok=True)


def calculate_sha256_hash(data: bytes) -> str:
    """Oblicza SHA-256 hash i zwraca jako base64"""
    hash_bytes = hashlib.sha256(data).digest()
    return base64.b64encode(hash_bytes).decode('utf-8')


@router.get("/")
async def signature_root():
    return {"message": "Signature API"}


@router.post("/prepare-signature-with-metadata")
async def prepare_signature_with_metadata(
    file: UploadFile = File(...),
    metadata: str = Form(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Przygotowuje plik do podpisania"""
    try:
        pdf_content = await file.read()
        metadata_dict = json.loads(metadata)
        
        print(f"\n📄 SPRAWDZANIE PLIKU: {file.filename}")
        
        try:
            pdf_reader = PdfReader(io.BytesIO(pdf_content))
            
            print(f"📄 PDF Metadata obecne: {pdf_reader.metadata is not None}")
            if pdf_reader.metadata:
                print(f"📄 Klucze metadanych: {list(pdf_reader.metadata.keys())}")
                print(f"📄 /Signature present: {'/Signature' in pdf_reader.metadata}")
                
                if '/Signature' in pdf_reader.metadata:
                    print("🚫 BLOKOWANIE - Dokument już podpisany!")
                    raise HTTPException(
                        status_code=400,
                        detail="❌ Ten dokument jest już podpisany! Nie można ponownie podpisać podpisanego dokumentu."
                    )
                else:
                    print("✅ OK - Dokument nie ma podpisu, można podpisać")
            else:
                print("⚠️ Brak metadanych w PDF")
                
        except HTTPException:
            raise
        except Exception as e:
            print(f"⚠️ Błąd sprawdzania metadanych: {e}")
        
        from ..services.crypto_service import calculate_pdf_content_hash
        file_hash_bytes = calculate_pdf_content_hash(pdf_content)
        file_hash_b64 = base64.b64encode(file_hash_bytes).decode('utf-8')
        
        print(f"📊 Hash zawartości do podpisania: {file_hash_b64[:64]}...")
        
        temp_dir = tempfile.mkdtemp()
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S_%f")
        filename = file.filename or "document.pdf"
        
        original_path = os.path.join(temp_dir, f"orig_{timestamp}_{filename}")
        temp_signed_path = os.path.join(temp_dir, f"temp_{timestamp}_{filename}")
        
        with open(original_path, "wb") as f:
            f.write(pdf_content)
        
        shutil.copy(original_path, temp_signed_path)
        
        return {
            "success": True,
            "file_hash": file_hash_b64,
            "temp_file_path": temp_signed_path,
            "original_filename": filename
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Error: {str(e)}")



@router.post("/embed-signature-to-db")
async def embed_signature_to_db(
    temp_file_path: str = Form(...),
    signature: str = Form(...),
    public_key: str = Form(...),
    metadata: str = Form(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Osadza podpis w PDF i zapisuje w bazie danych"""
    try:
        metadata_dict = json.loads(metadata)
        
        if not os.path.exists(temp_file_path):
            raise HTTPException(404, "Temporary file not found")
        
        with open(temp_file_path, 'rb') as f:
            pdf_content = f.read()
        
        from ..services.crypto_service import calculate_pdf_content_hash
        file_hash_bytes = calculate_pdf_content_hash(pdf_content)
        file_hash_b64 = base64.b64encode(file_hash_bytes).decode('utf-8')
        
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        safe_filename = f"{current_user.username}_{timestamp}_{metadata_dict.get('filename', 'document.pdf')}"
        signed_pdf_path = SIGNED_PDF_DIR / safe_filename
        
        metadata_dict['timestamp'] = datetime.utcnow().isoformat()
        
        success = PdfService.embed_signature_in_pdf(
            input_pdf_path=temp_file_path,
            output_pdf_path=str(signed_pdf_path),
            signature_data=signature,
            file_hash=file_hash_b64,
            metadata=metadata_dict
        )
        
        if not success:
            raise HTTPException(500, "Nie udało się osadzić podpisu w PDF")
        
        new_signature = Signature(
            user_id=current_user.id,
            file_hash=file_hash_b64,
            signature_data=signature,
            public_key_jwk=public_key,
            signer_name=metadata_dict.get('name'),
            signer_location=metadata_dict.get('location'),
            signer_reason=metadata_dict.get('reason'),
            signer_contact=metadata_dict.get('contact'),
            original_filename=metadata_dict.get('filename'),
            signed_pdf_path=str(signed_pdf_path)
        )
        
        db.add(new_signature)
        db.commit()
        
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)
        
        return {
            "success": True,
            "message": "✅ PDF podpisany i zapisany w systemie!",
            "signature_id": new_signature.id,
            "filename": safe_filename
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Error: {str(e)}")


@router.get("/signed-pdfs")
async def list_signed_pdfs(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Lista wszystkich podpisanych PDF-ów"""
    signatures = db.query(Signature).order_by(Signature.created_at.desc()).all()
    
    return {
        "success": True,
        "count": len(signatures),
        "documents": [
            {
                "id": sig.id,
                "filename": sig.original_filename,
                "signer": sig.signer_name,
                "username": sig.signer.username,
                "signed_at": sig.created_at.isoformat(),
                "location": sig.signer_location,
                "reason": sig.signer_reason
            }
            for sig in signatures
        ]
    }


@router.get("/download-signed-pdf/{signature_id}")
async def download_signed_pdf(
    signature_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Pobiera podpisany PDF"""
    signature = db.query(Signature).filter(Signature.id == signature_id).first()
    
    if not signature:
        raise HTTPException(404, "Podpis nie znaleziony")
    
    if not signature.signed_pdf_path or not os.path.exists(signature.signed_pdf_path):
        raise HTTPException(404, "Plik nie istnieje na serwerze")
    
    return FileResponse(
        signature.signed_pdf_path,
        filename=signature.original_filename or "signed_document.pdf",
        media_type='application/pdf'
    )


@router.get("/download-public-key/{signature_id}")
async def download_public_key(
    signature_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Pobiera klucz publiczny dla danego podpisu w formacie JSON"""
    
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Tylko administratorzy mogą pobierać klucze")
    
    signature = db.query(Signature).filter(Signature.id == signature_id).first()
    
    if not signature:
        raise HTTPException(404, "Podpis nie znaleziony")
    
    if not signature.public_key_jwk:
        raise HTTPException(404, "Klucz publiczny nie jest dostępny dla tego podpisu")
    
    try:
        public_key_data = json.loads(signature.public_key_jwk)
        
        key_file_content = {
            "version": "1.0",
            "publicKey": public_key_data,
            "document_info": {
                "filename": signature.original_filename,
                "signer": signature.signer_name,
                "signed_at": signature.created_at.isoformat(),
                "location": signature.signer_location,
                "reason": signature.signer_reason
            },
            "description": "Klucz publiczny do weryfikacji podpisu cyfrowego"
        }
        
        temp_dir = tempfile.mkdtemp()
        safe_filename = signature.original_filename.replace('.pdf', '') if signature.original_filename else 'document'
        json_filename = f"public_key_{safe_filename}.json"
        json_path = os.path.join(temp_dir, json_filename)
        
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(key_file_content, f, indent=2, ensure_ascii=False)
        
        return FileResponse(
            json_path,
            filename=json_filename,
            media_type='application/json',
            background=None
        )
        
    except json.JSONDecodeError:
        raise HTTPException(500, "Błąd parsowania klucza publicznego")
    except Exception as e:
        raise HTTPException(500, f"Błąd pobierania klucza: {str(e)}")


@router.post("/verify-signature")
async def verify_signature(
    file: UploadFile = File(...),
    public_key: str = Form(...)
):
    """Weryfikuje podpis cyfrowy PDF"""
    try:
        public_key_jwk = json.loads(public_key)
        
        pdf_content = await file.read()
        
        result = crypto_service.verify_pdf_signature(pdf_content, public_key_jwk)
        
        if result['valid']:
            return {
                'valid': True,
                'message': 'Podpis jest prawidłowy!',
                'metadata': result.get('metadata')
            }
        else:
            return {
                'valid': False,
                'message': result.get('error', 'Podpis nieprawidłowy')
            }
            
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Nieprawidłowy format klucza publicznego")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Błąd weryfikacji: {str(e)}")
