from sqlalchemy import create_engine, Column, String, Integer, DateTime, Text, Boolean, ForeignKey
from sqlalchemy.orm import sessionmaker, relationship, declarative_base
from datetime import datetime
import uuid

DATABASE_URL = "sqlite:///./signatures.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class User(Base):
    """Model użytkownika"""
    __tablename__ = "users"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    username = Column(String, unique=True, nullable=False, index=True)
    email = Column(String, unique=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, default="user")
    created_at = Column(DateTime, default=datetime.utcnow)
    
    signatures = relationship("Signature", back_populates="signer")


class Signature(Base):
    """Model podpisu cyfrowego"""
    __tablename__ = "signatures"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    
    user_id = Column(String, ForeignKey('users.id'), nullable=False)
    
    file_hash = Column(String, nullable=False)
    signature_data = Column(Text, nullable=False)
    public_key_jwk = Column(Text, nullable=False)
    
    signed_pdf_path = Column(String, nullable=True)
    original_filename = Column(String, nullable=True)
    
    signer_name = Column(String, nullable=True)
    signer_location = Column(String, nullable=True)
    signer_reason = Column(String, nullable=True)
    signer_contact = Column(String, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    signer = relationship("User", back_populates="signatures")


def init_db():
    """Inicjalizuje bazę danych"""
    Base.metadata.create_all(bind=engine)


def get_db():
    """Dependency dla FastAPI"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
