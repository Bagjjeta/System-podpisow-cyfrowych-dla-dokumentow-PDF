import json
from PyPDF2 import PdfReader, PdfWriter
from datetime import datetime


class PdfService:
    @staticmethod
    def embed_signature_in_pdf(
        input_pdf_path: str,
        output_pdf_path: str,
        signature_data: str,
        file_hash: str,
        metadata: dict = None
    ) -> bool:
        """
        Osadza podpis cyfrowy i metadane w PDF.
        Zapisuje w /Signature: {signature, file_hash, metadata}
        """
        try:
            reader = PdfReader(input_pdf_path)
            writer = PdfWriter()
            
            for page in reader.pages:
                writer.add_page(page)
            
            timestamp = metadata.get('timestamp', '') if metadata else ''
            if not timestamp:
                timestamp = datetime.utcnow().isoformat()
            
            signature_info = {
                'signature': signature_data,
                'file_hash': file_hash,
                'metadata': {
                    'name': metadata.get('name', 'Unknown') if metadata else 'Unknown',
                    'location': metadata.get('location', 'Unknown') if metadata else 'Unknown',
                    'reason': metadata.get('reason', 'Digital Signature') if metadata else 'Digital Signature',
                    'contact': metadata.get('contact', '') if metadata else '',
                    'timestamp': timestamp
                }
            }
            
            writer.add_metadata({
                '/Title': f"Signed: {metadata.get('filename', 'Document')}",
                '/Author': metadata.get('name', 'Unknown'),
                '/Subject': f"Digitally signed document - {metadata.get('reason', 'Digital Signature')}",
                '/Creator': 'PDF Signature System v1.0',
                '/Producer': 'PDF Signature System v1.0',
                '/Keywords': f"digital signature, {metadata.get('name', '')}, {metadata.get('location', '')}",
                '/Signature': json.dumps(signature_info),
                '/SignerName': metadata.get('name', 'Unknown'),
                '/SignerLocation': metadata.get('location', 'Unknown'),
                '/SignerContact': metadata.get('contact', ''),
                '/SignatureReason': metadata.get('reason', 'Digital Signature'),
                '/SignatureDate': timestamp,
                '/DocumentHash': file_hash[:64] + '...'
            })
            
            with open(output_pdf_path, 'wb') as output_file:
                writer.write(output_file)
            
            print("✅ PDF ZAPISANY - Metadane dodane:")
            print(f"   /Signature present: True")
            print(f"   /SignerName: {metadata.get('name', 'Unknown')}")
            
            verify_reader = PdfReader(output_pdf_path)
            print(f"🔍 WERYFIKACJA - Metadane w zapisanym PDF:")
            if verify_reader.metadata:
                print(f"   Wszystkie klucze: {list(verify_reader.metadata.keys())}")
                print(f"   /Signature exists: {'/Signature' in verify_reader.metadata}")
                if '/Signature' in verify_reader.metadata:
                    print(f"   /Signature value: {verify_reader.metadata['/Signature'][:100]}...")
            else:
                print("   ⚠️ BRAK METADANYCH!")
            
            return True
            
        except Exception as e:
            print(f"❌ Error embedding signature: {e}")
            import traceback
            traceback.print_exc()
            return False
