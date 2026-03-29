"""Endpointy administracyjne do przeglądania bazy danych."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from datetime import datetime
import os

from ..database import get_db, Signature, User
from ..auth import get_current_user

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/signatures")
async def get_all_signatures(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Pobiera wszystkie podpisy z bazy danych"""
    
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Tylko administratorzy mają dostęp")
    
    signatures = db.query(Signature).order_by(Signature.created_at.desc()).all()
    
    records = []
    for sig in signatures:
        records.append({
            "id": sig.id,
            "file_hash": sig.file_hash[:32] + "..." if len(sig.file_hash) > 32 else sig.file_hash,
            "signature_preview": sig.signature_data[:32] + "..." if len(sig.signature_data) > 32 else sig.signature_data,
            "signer_name": sig.signer_name or "Brak",
            "signer_location": sig.signer_location or "Brak",
            "signer_reason": sig.signer_reason or "Brak",
            "signer_contact": sig.signer_contact or "Brak",
            "original_filename": sig.original_filename or "Brak",
            "created_at": sig.created_at.isoformat(),
            "created_at_formatted": sig.created_at.strftime("%Y-%m-%d %H:%M:%S"),
            "username": sig.signer.username
        })
    
    return {
        "total_count": len(records),
        "records": records
    }


@router.get("/signatures/{signature_id}")
async def get_signature_details(
    signature_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Pobiera szczegóły pojedynczego podpisu"""
    
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Tylko administratorzy mają dostęp")
    
    sig = db.query(Signature).filter(Signature.id == signature_id).first()
    
    if not sig:
        raise HTTPException(status_code=404, detail="Signature not found")
    
    return {
        "id": sig.id,
        "file_hash": sig.file_hash,
        "signature_data": sig.signature_data,
        "public_key_jwk": sig.public_key_jwk,
        "signer_name": sig.signer_name,
        "signer_location": sig.signer_location,
        "signer_reason": sig.signer_reason,
        "signer_contact": sig.signer_contact,
        "original_filename": sig.original_filename,
        "created_at": sig.created_at.isoformat(),
        "username": sig.signer.username
    }


@router.get("/database/info")
async def get_database_info(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Zwraca informacje o strukturze bazy danych"""
    
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Tylko administratorzy mają dostęp")
    
    total_signatures = db.query(Signature).count()
    latest_signature = db.query(Signature).order_by(Signature.created_at.desc()).first()
    
    columns = [
        {"name": "id", "type": "String (UUID)", "description": "Unikalny identyfikator podpisu"},
        {"name": "file_hash", "type": "String", "description": "Hash SHA-256 pliku PDF (Base64)"},
        {"name": "signature_data", "type": "Text", "description": "Podpis cyfrowy RSA-PSS (Base64)"},
        {"name": "public_key_jwk", "type": "Text", "description": "Klucz publiczny w formacie JWK (JSON)"},
        {"name": "signer_name", "type": "String", "description": "Imię i nazwisko osoby podpisującej"},
        {"name": "signer_location", "type": "String", "description": "Lokalizacja osoby podpisującej"},
        {"name": "signer_reason", "type": "String", "description": "Powód podpisania dokumentu"},
        {"name": "signer_contact", "type": "String", "description": "Dane kontaktowe osoby podpisującej"},
        {"name": "original_filename", "type": "String", "description": "Oryginalna nazwa pliku PDF"},
        {"name": "created_at", "type": "DateTime", "description": "Data utworzenia rekordu (UTC)"}
    ]
    
    return {
        "database": "SQLite",
        "table_name": "signatures",
        "total_records": total_signatures,
        "latest_signature_date": latest_signature.created_at.isoformat() if latest_signature else None,
        "columns": columns
    }


@router.delete("/signatures/{signature_id}")
async def delete_signature(
    signature_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, str]:
    """Usuwa podpis z bazy danych (tylko admin)"""
    
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Tylko administratorzy mogą usuwać")
    
    sig = db.query(Signature).filter(Signature.id == signature_id).first()
    
    if not sig:
        raise HTTPException(status_code=404, detail="Signature not found")
    
    if sig.signed_pdf_path and os.path.exists(sig.signed_pdf_path):
        try:
            os.remove(sig.signed_pdf_path)
        except Exception as e:
            print(f"Błąd usuwania pliku: {e}")
    
    db.delete(sig)
    db.commit()
    
    return {"status": "success", "message": f"Signature {signature_id} deleted"}


@router.get("/documents")
async def list_all_documents(
    username: str = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Lista wszystkich dokumentów (opcjonalnie filtruj po username)"""
    
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Tylko administratorzy mają dostęp")
    
    query = db.query(Signature)
    
    if username:
        query = query.join(User).filter(User.username == username)
    
    documents = query.order_by(Signature.created_at.desc()).all()
    
    users_dict = {}
    for doc in documents:
        user_username = doc.signer.username
        if user_username not in users_dict:
            users_dict[user_username] = []
        users_dict[user_username].append({
            'id': doc.id,
            'filename': doc.original_filename,
            'signer': doc.signer_name,
            'signed_at': doc.created_at.isoformat(),
            'location': doc.signer_location,
            'reason': doc.signer_reason
        })
    
    return {
        'total': len(documents),
        'users': users_dict,
        'documents': [
            {
                'id': doc.id,
                'filename': doc.original_filename,
                'signer': doc.signer_name,
                'username': doc.signer.username,
                'signed_at': doc.created_at.isoformat(),
                'location': doc.signer_location,
                'reason': doc.signer_reason
            }
            for doc in documents
        ]
    }


@router.delete("/documents/{document_id}")
async def delete_document(
    document_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Usuwa dokument z bazy (tylko admin)"""
    
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Tylko administratorzy mogą usuwać dokumenty")
    
    document = db.query(Signature).filter(Signature.id == document_id).first()
    
    if not document:
        raise HTTPException(status_code=404, detail="Dokument nie znaleziony")
    
    if document.signed_pdf_path and os.path.exists(document.signed_pdf_path):
        try:
            os.remove(document.signed_pdf_path)
        except Exception as e:
            print(f"Błąd usuwania pliku: {e}")
    
    db.delete(document)
    db.commit()
    
    return {"message": "Dokument usunięty", "filename": document.original_filename}
