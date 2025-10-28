from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
from passlib.context import CryptContext
from jose import JWTError, jwt
import base64
import json
import io
from io import BytesIO
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
import gspread
from google.oauth2.service_account import Credentials

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Security
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()
SECRET_KEY = os.environ.get("JWT_SECRET", "icd-tuning-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 30

# Google Sheets Configuration
GOOGLE_SHEETS_ENABLED = os.environ.get("GOOGLE_SHEETS_ENABLED", "false").lower() == "true"
GOOGLE_SHEET_ID = os.environ.get("GOOGLE_SHEET_ID", "")
GOOGLE_SERVICE_ACCOUNT_JSON = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON", "")

def get_google_sheets_client():
    """Initialize Google Sheets client"""
    if not GOOGLE_SHEETS_ENABLED or not GOOGLE_SERVICE_ACCOUNT_JSON:
        return None
    
    try:
        # Parse service account JSON
        service_account_info = json.loads(GOOGLE_SERVICE_ACCOUNT_JSON)
        
        # Define the scope
        scopes = [
            'https://www.googleapis.com/auth/spreadsheets',
            'https://www.googleapis.com/auth/drive'
        ]
        
        # Create credentials
        credentials = Credentials.from_service_account_info(
            service_account_info,
            scopes=scopes
        )
        
        # Authorize and return client
        client = gspread.authorize(credentials)
        return client
    except Exception as e:
        logging.error(f"Failed to initialize Google Sheets client: {str(e)}")
        return None

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

# Models
class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    role: str  # Manager or Mechanic
    full_name: str

class UserCreate(BaseModel):
    username: str
    password: str
    role: str
    full_name: str

class UserLogin(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user: User

class Job(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    customer_name: str
    contact_number: str
    car_brand: str
    car_model: str
    year: int
    registration_number: str
    vin: str  # Now mandatory
    kms: int  # Now mandatory (odometer)
    entry_date: datetime
    work_description: str
    estimated_delivery: datetime
    assigned_mechanic_id: str
    assigned_mechanic_name: str
    status: str = "Car Received"  # New default status
    photos: List[str] = []  # base64 encoded images
    notes: Optional[str] = None
    completion_date: Optional[datetime] = None
    confirm_complete: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class JobCreate(BaseModel):
    customer_name: str
    contact_number: str
    car_brand: str
    car_model: str
    year: int
    registration_number: str
    vin: str  # Now mandatory
    kms: int  # Now mandatory (odometer)
    entry_date: str
    work_description: str
    estimated_delivery: str
    assigned_mechanic_id: str

class JobUpdate(BaseModel):
    customer_name: Optional[str] = None
    contact_number: Optional[str] = None
    car_brand: Optional[str] = None
    car_model: Optional[str] = None
    year: Optional[int] = None
    registration_number: Optional[str] = None
    vin: Optional[str] = None
    kms: Optional[int] = None
    entry_date: Optional[str] = None
    work_description: Optional[str] = None
    estimated_delivery: Optional[str] = None
    assigned_mechanic_id: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    confirm_complete: Optional[bool] = None

class JobPhoto(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    job_id: str
    photo_url: str
    photo_type: str  # Before or After
    uploaded_by: str
    upload_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class JobNote(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    job_id: str
    note_text: str
    created_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Invoice(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    invoice_number: str
    job_id: str
    invoice_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    labour_charges: float
    parts: List[dict] = []  # List of parts with names and charges
    parts_charges: float  # Total of all parts
    tuning_charges: float
    others_charges: float
    subtotal: float
    gst_amount: float
    grand_total: float
    sent_to_customer: bool = False
    sent_to_accountant: bool = False

class PartItem(BaseModel):
    part_name: str
    part_charges: float

class InvoiceCreate(BaseModel):
    job_id: str
    labour_charges: float
    parts: List[PartItem] = []  # List of parts with names and charges
    tuning_charges: float
    others_charges: float
    gst_rate: Optional[float] = 18.0  # Optional GST rate, default 18%
    invoice_number: Optional[str] = None  # Optional custom invoice number
    invoice_date: Optional[str] = None  # Optional custom invoice date

class InvoiceData(BaseModel):
    labour_cost: float = 0
    parts_cost: float = 0
    tuning_cost: float = 0
    other_charges: float = 0
    custom_charges: List[dict] = []  # [{"description": "...", "amount": 0}]
    gst_rate: float = 18.0


# Helper Functions
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if user is None:
        raise credentials_exception
    return User(**user)

# Mock Integration Functions
def send_whatsapp_message(phone_number: str, message: str):
    """Mock WhatsApp Business API - Replace with actual implementation"""
    print(f"[MOCK WhatsApp] Sending to {phone_number}: {message}")
    # In production, integrate with WhatsApp Business API
    return {"success": True, "message": "WhatsApp message sent (mocked)"}

def send_email(to_email: str, subject: str, body: str, attachment=None):
    """Mock Mailchimp Email - Replace with actual implementation"""
    print(f"[MOCK Email] Sending to {to_email}: {subject}")
    # In production, integrate with Mailchimp Transactional API
    return {"success": True, "message": "Email sent (mocked)"}

def export_to_google_sheets(data: list):
    """Mock Google Sheets Export - Replace with actual implementation"""
    print(f"[MOCK Google Sheets] Exporting {len(data)} records")
    # In production, integrate with Google Sheets API
    return {"success": True, "message": "Exported to Google Sheets (mocked)"}

def generate_invoice_pdf(invoice_data: dict, job_data: dict):
    """Generate ICD Tuning branded invoice PDF"""
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    width, height = letter
    
    # Colors
    black = HexColor("#000000")
    red = HexColor("#D32F2F")
    white = HexColor("#FFFFFF")
    
    # Background
    c.setFillColor(black)
    c.rect(0, 0, width, height, fill=True)
    
    # Logo area (top left) - placeholder
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 24)
    c.drawString(50, height - 60, "ICD TUNING")
    
    # Invoice title (red)
    c.setFillColor(red)
    c.setFont("Helvetica-Bold", 32)
    c.drawString(width - 200, height - 60, "INVOICE")
    
    # Business info
    c.setFillColor(white)
    c.setFont("Helvetica", 10)
    y_pos = height - 100
    c.drawString(50, y_pos, "ICD Tuning – Performance Tuning | ECU Remaps | Custom Builds")
    c.drawString(50, y_pos - 15, "Chennai, Tamil Nadu")
    c.drawString(50, y_pos - 30, "📞 +91 98765 43210 ✉ icdtuning@gmail.com")
    
    # Invoice details
    y_pos = height - 180
    c.setFont("Helvetica-Bold", 11)
    c.drawString(50, y_pos, f"Invoice No: {invoice_data['invoice_number']}")
    c.drawString(50, y_pos - 20, f"Date: {invoice_data['invoice_date'].strftime('%d-%m-%Y')}")
    c.drawString(50, y_pos - 40, f"Customer: {job_data['customer_name']}")
    c.drawString(50, y_pos - 60, f"Car: {job_data['car_brand']} {job_data['car_model']} ({job_data['year']})")
    c.drawString(50, y_pos - 80, f"Reg No: {job_data['registration_number']}")
    
    # Work description
    c.setFont("Helvetica", 10)
    c.drawString(50, y_pos - 110, f"Work: {job_data['work_description'][:70]}")
    
    # Line separator
    c.setStrokeColor(red)
    c.setLineWidth(2)
    y_pos = height - 320
    c.line(50, y_pos, width - 50, y_pos)
    
    # Charges breakdown
    c.setFillColor(white)
    y_pos -= 40
    c.setFont("Helvetica-Bold", 11)
    c.drawString(50, y_pos, "Description")
    c.drawString(width - 150, y_pos, "Amount (₹)")
    
    y_pos -= 25
    c.setFont("Helvetica", 10)
    c.drawString(50, y_pos, "Labour Charges")
    c.drawString(width - 150, y_pos, f"{invoice_data['labour_charges']:.2f}")
    
    y_pos -= 20
    c.drawString(50, y_pos, "Parts Charges")
    c.drawString(width - 150, y_pos, f"{invoice_data['parts_charges']:.2f}")
    
    y_pos -= 20
    c.drawString(50, y_pos, "ECU Tuning/Remapping")
    c.drawString(width - 150, y_pos, f"{invoice_data['tuning_charges']:.2f}")
    
    y_pos -= 20
    c.drawString(50, y_pos, "Other Charges")
    c.drawString(width - 150, y_pos, f"{invoice_data['others_charges']:.2f}")
    
    # Line
    c.setStrokeColor(white)
    c.setLineWidth(1)
    y_pos -= 15
    c.line(width - 200, y_pos, width - 50, y_pos)
    
    # Subtotal
    y_pos -= 25
    c.setFont("Helvetica-Bold", 10)
    c.drawString(50, y_pos, "Subtotal")
    c.drawString(width - 150, y_pos, f"{invoice_data['subtotal']:.2f}")
    
    # Only show GST if it's greater than 0
    if invoice_data['gst_amount'] > 0:
        gst_percent = (invoice_data['gst_amount'] / invoice_data['subtotal']) * 100 if invoice_data['subtotal'] > 0 else 0
        y_pos -= 20
        c.drawString(50, y_pos, f"GST ({gst_percent:.1f}%)")
        c.drawString(width - 150, y_pos, f"{invoice_data['gst_amount']:.2f}")
    
    # Line
    c.setStrokeColor(red)
    c.setLineWidth(2)
    y_pos -= 15
    c.line(width - 200, y_pos, width - 50, y_pos)
    
    # Grand Total
    y_pos -= 30
    c.setFillColor(red)
    c.setFont("Helvetica-Bold", 14)
    c.drawString(50, y_pos, "GRAND TOTAL")
    c.drawString(width - 150, y_pos, f"₹ {invoice_data['grand_total']:.2f}")
    
    # Footer
    c.setFillColor(white)
    c.setFont("Helvetica", 8)
    c.drawString(50, 80, "Signature: _______________________")
    c.drawString(width - 250, 80, "Customer Signature: _______________________")
    
    c.setFont("Helvetica-Oblique", 9)
    c.drawString(50, 50, "Terms: All tuning work done by ICD Tuning is tested and verified for safety and performance.")
    
    c.save()
    buffer.seek(0)
    return buffer

# Auth Routes
@api_router.post("/auth/register", response_model=Token)
async def register(user_data: UserCreate):
    # Check if user exists
    existing = await db.users.find_one({"username": user_data.username})
    if existing:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    # Create user
    user_dict = user_data.model_dump()
    password = user_dict.pop("password")
    user_dict["password_hash"] = get_password_hash(password)
    user_dict["id"] = str(uuid.uuid4())
    
    await db.users.insert_one(user_dict)
    
    user_obj = User(**{k: v for k, v in user_dict.items() if k != "password_hash"})
    access_token = create_access_token(data={"sub": user_obj.id})
    return Token(access_token=access_token, token_type="bearer", user=user_obj)

@api_router.post("/auth/login", response_model=Token)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"username": credentials.username})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not verify_password(credentials.password, user['password_hash']):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    user_obj = User(**{k: v for k, v in user.items() if k not in ["_id", "password_hash"]})
    access_token = create_access_token(data={"sub": user_obj.id})
    return Token(access_token=access_token, token_type="bearer", user=user_obj)

@api_router.get("/auth/me", response_model=User)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user

# Mechanic Routes
@api_router.get("/mechanics", response_model=List[User])
async def get_mechanics(current_user: User = Depends(get_current_user)):
    if current_user.role != "Manager":
        raise HTTPException(status_code=403, detail="Only managers can view mechanics")
    
    mechanics = await db.users.find({"role": "Mechanic"}, {"_id": 0}).to_list(1000)
    return [User(**m) for m in mechanics]

# Job Routes
@api_router.post("/jobs", response_model=Job)
async def create_job(job_data: JobCreate, current_user: User = Depends(get_current_user)):
    if current_user.role != "Manager":
        raise HTTPException(status_code=403, detail="Only managers can create jobs")
    
    # Validate mandatory fields
    if not job_data.vin or job_data.vin.strip() == "":
        raise HTTPException(status_code=400, detail="VIN is mandatory and cannot be empty")
    
    if job_data.kms is None or job_data.kms < 0:
        raise HTTPException(status_code=400, detail="Odometer reading (KMs) is mandatory and must be a positive number")
    
    # Get mechanic name
    mechanic = await db.users.find_one({"id": job_data.assigned_mechanic_id}, {"_id": 0})
    if not mechanic:
        raise HTTPException(status_code=404, detail="Mechanic not found")
    
    job_dict = job_data.model_dump()
    job_dict['assigned_mechanic_name'] = mechanic['full_name']
    job_dict['entry_date'] = datetime.fromisoformat(job_data.entry_date)
    job_dict['estimated_delivery'] = datetime.fromisoformat(job_data.estimated_delivery)
    
    job = Job(**job_dict)
    
    job_dict = job.model_dump()
    job_dict['entry_date'] = job_dict['entry_date'].isoformat()
    job_dict['estimated_delivery'] = job_dict['estimated_delivery'].isoformat()
    job_dict['created_at'] = job_dict['created_at'].isoformat()
    
    await db.jobs.insert_one(job_dict)
    return job

@api_router.get("/jobs", response_model=List[Job])
async def get_jobs(current_user: User = Depends(get_current_user)):
    query = {}
    if current_user.role == "Mechanic":
        query = {"assigned_mechanic_id": current_user.id}
    
    jobs = await db.jobs.find(query, {"_id": 0}).to_list(1000)
    
    # Convert ISO strings back to datetime
    for job in jobs:
        if isinstance(job.get('entry_date'), str):
            job['entry_date'] = datetime.fromisoformat(job['entry_date'])
        if isinstance(job.get('estimated_delivery'), str):
            job['estimated_delivery'] = datetime.fromisoformat(job['estimated_delivery'])
        if job.get('completion_date') and isinstance(job['completion_date'], str):
            job['completion_date'] = datetime.fromisoformat(job['completion_date'])
        if isinstance(job.get('created_at'), str):
            job['created_at'] = datetime.fromisoformat(job['created_at'])
    
    return [Job(**job) for job in jobs]

@api_router.get("/jobs/{job_id}", response_model=Job)
async def get_job(job_id: str, current_user: User = Depends(get_current_user)):
    job = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Check access
    if current_user.role == "Mechanic" and job['assigned_mechanic_id'] != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Convert ISO strings
    if isinstance(job.get('entry_date'), str):
        job['entry_date'] = datetime.fromisoformat(job['entry_date'])
    if isinstance(job.get('estimated_delivery'), str):
        job['estimated_delivery'] = datetime.fromisoformat(job['estimated_delivery'])
    if job.get('completion_date') and isinstance(job['completion_date'], str):
        job['completion_date'] = datetime.fromisoformat(job['completion_date'])
    if isinstance(job.get('created_at'), str):
        job['created_at'] = datetime.fromisoformat(job['created_at'])
    
    return Job(**job)

@api_router.patch("/jobs/{job_id}", response_model=Job)
async def update_job(job_id: str, update_data: JobUpdate, current_user: User = Depends(get_current_user)):
    job = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Check access
    if current_user.role == "Mechanic" and job['assigned_mechanic_id'] != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    update_dict = {k: v for k, v in update_data.model_dump().items() if v is not None}
    
    # Handle mechanic reassignment (Manager only)
    if update_dict.get('assigned_mechanic_id') and current_user.role == "Manager":
        mechanic = await db.users.find_one({"id": update_dict['assigned_mechanic_id']}, {"_id": 0})
        if mechanic:
            update_dict['assigned_mechanic_name'] = mechanic['full_name']
    
    # Handle date conversions
    if update_dict.get('entry_date'):
        update_dict['entry_date'] = datetime.fromisoformat(update_dict['entry_date']).isoformat()
    if update_dict.get('estimated_delivery'):
        update_dict['estimated_delivery'] = datetime.fromisoformat(update_dict['estimated_delivery']).isoformat()
    
    # Auto-set completion date when status changes to Work complete
    if update_dict.get('status') == 'Work complete' and job.get('status') != 'Work complete':
        update_dict['completion_date'] = datetime.now(timezone.utc).isoformat()
    
    if update_dict:
        await db.jobs.update_one({"id": job_id}, {"$set": update_dict})
    
    updated_job = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    
    # Convert ISO strings
    if isinstance(updated_job.get('entry_date'), str):
        updated_job['entry_date'] = datetime.fromisoformat(updated_job['entry_date'])
    if isinstance(updated_job.get('estimated_delivery'), str):
        updated_job['estimated_delivery'] = datetime.fromisoformat(updated_job['estimated_delivery'])
    if updated_job.get('completion_date') and isinstance(updated_job['completion_date'], str):
        updated_job['completion_date'] = datetime.fromisoformat(updated_job['completion_date'])
    if isinstance(updated_job.get('created_at'), str):
        updated_job['created_at'] = datetime.fromisoformat(updated_job['created_at'])
    
    return Job(**updated_job)


@api_router.post("/jobs/{job_id}/photos")
async def add_job_photo(job_id: str, photo: UploadFile = File(...), current_user: User = Depends(get_current_user)):
    """Add photo to a job"""
    job = await db.jobs.find_one({"id": job_id})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Read and encode image
    image_data = await photo.read()
    base64_image = base64.b64encode(image_data).decode('utf-8')
    image_url = f"data:{photo.content_type};base64,{base64_image}"
    
    # Add to photos array
    await db.jobs.update_one(
        {"id": job_id},
        {"$push": {"photos": image_url}}
    )
    
    return {"message": "Photo added successfully", "photo_url": image_url}

# Statistics Endpoint
@api_router.get("/stats")
async def get_stats(current_user: User = Depends(get_current_user)):
    """Get job statistics for dashboard"""
    query = {}
    if current_user.role == "Mechanic":
        query["assigned_mechanic_id"] = current_user.id
    
    all_jobs = await db.jobs.find(query, {"_id": 0}).to_list(1000)
    
    active_count = sum(1 for j in all_jobs if j.get("status") in ["Pending", "In Progress"])
    completed_count = sum(1 for j in all_jobs if j.get("status") in ["Done", "Delivered"])
    total_count = len(all_jobs)
    
    return {
        "active": active_count,
        "completed": completed_count,
        "total": total_count
    }


# Invoice Routes
@api_router.post("/invoices", response_model=Invoice)
async def create_invoice(invoice_data: InvoiceCreate, current_user: User = Depends(get_current_user)):
    if current_user.role != "Manager":
        raise HTTPException(status_code=403, detail="Only managers can create invoices")
    
    # Get job
    job = await db.jobs.find_one({"id": invoice_data.job_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Calculate totals
    subtotal = (invoice_data.labour_charges + invoice_data.parts_charges + 
                invoice_data.tuning_charges + invoice_data.others_charges)
    
    # Apply GST if rate is provided and > 0
    gst_rate = invoice_data.gst_rate if invoice_data.gst_rate is not None else 18.0
    gst_amount = subtotal * (gst_rate / 100) if gst_rate > 0 else 0
    grand_total = subtotal + gst_amount
    
    # Use custom invoice number if provided, otherwise generate
    if invoice_data.invoice_number and invoice_data.invoice_number.strip():
        invoice_number = invoice_data.invoice_number.strip()
    else:
        count = await db.invoices.count_documents({}) + 1
        invoice_number = f"ICD-2025-{count:04d}"
    
    # Use custom invoice date if provided, otherwise use current date
    if invoice_data.invoice_date and invoice_data.invoice_date.strip():
        invoice_date = datetime.fromisoformat(invoice_data.invoice_date)
    else:
        invoice_date = datetime.now(timezone.utc)
    
    invoice = Invoice(
        invoice_number=invoice_number,
        job_id=invoice_data.job_id,
        invoice_date=invoice_date,
        labour_charges=invoice_data.labour_charges,
        parts_charges=invoice_data.parts_charges,
        tuning_charges=invoice_data.tuning_charges,
        others_charges=invoice_data.others_charges,
        subtotal=subtotal,
        gst_amount=gst_amount,
        grand_total=grand_total
    )
    
    invoice_dict = invoice.model_dump()
    invoice_dict['invoice_date'] = invoice_dict['invoice_date'].isoformat()
    
    await db.invoices.insert_one(invoice_dict)
    return invoice

@api_router.get("/invoices/{invoice_id}/pdf")
async def get_invoice_pdf(invoice_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role != "Manager":
        raise HTTPException(status_code=403, detail="Only managers can access invoices")
    
    invoice = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    job = await db.jobs.find_one({"id": invoice['job_id']}, {"_id": 0})
    
    # Convert ISO strings for display
    if isinstance(invoice.get('invoice_date'), str):
        invoice['invoice_date'] = datetime.fromisoformat(invoice['invoice_date'])
    
    pdf_buffer = generate_invoice_pdf(invoice, job)
    
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename={invoice['invoice_number']}.pdf",
            "Content-Type": "application/pdf",
            "Cache-Control": "no-cache",
            "Access-Control-Expose-Headers": "Content-Disposition"
        }
    )

@api_router.get("/invoices/job/{job_id}", response_model=List[Invoice])
async def get_job_invoices(job_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role != "Manager":
        raise HTTPException(status_code=403, detail="Only managers can view invoices")
    
    invoices = await db.invoices.find({"job_id": job_id}, {"_id": 0}).to_list(1000)
    
    for inv in invoices:
        if isinstance(inv.get('invoice_date'), str):
            inv['invoice_date'] = datetime.fromisoformat(inv['invoice_date'])
    
    return [Invoice(**inv) for inv in invoices]

# Communication Routes
@api_router.post("/jobs/{job_id}/send-confirmation")
async def send_job_confirmation(job_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role != "Manager":
        raise HTTPException(status_code=403, detail="Only managers can send confirmations")
    
    job = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    message = f"Hi {job['customer_name']}, your {job['car_model']} service is completed and ready for delivery. — ICD Tuning, Chennai"
    
    result = send_whatsapp_message(job['contact_number'], message)
    return result

@api_router.post("/invoices/{invoice_id}/send")
async def send_invoice(invoice_id: str, send_type: str, current_user: User = Depends(get_current_user)):
    if current_user.role != "Manager":
        raise HTTPException(status_code=403, detail="Only managers can send invoices")
    
    invoice = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    job = await db.jobs.find_one({"id": invoice['job_id']}, {"_id": 0})
    
    if send_type == "customer":
        result = send_whatsapp_message(
            job['contact_number'],
            f"Your invoice {invoice['invoice_number']} is ready. Total: ₹{invoice['grand_total']}"
        )
        await db.invoices.update_one({"id": invoice_id}, {"$set": {"sent_to_customer": True}})
    elif send_type == "accountant":
        result = send_email(
            "accountant@icdtuning.com",
            f"Invoice {invoice['invoice_number']}",
            f"Invoice for {job['customer_name']} - {job['car_model']}"
        )
        await db.invoices.update_one({"id": invoice_id}, {"$set": {"sent_to_accountant": True}})
    else:
        raise HTTPException(status_code=400, detail="Invalid send type")
    
    return result

@api_router.post("/export/google-sheets")
async def export_to_sheets(current_user: User = Depends(get_current_user)):
    """Export all jobs to Google Sheets"""
    if current_user.role != "Manager":
        raise HTTPException(status_code=403, detail="Only managers can export data")
    
    if not GOOGLE_SHEETS_ENABLED:
        return {
            "success": False,
            "message": "Google Sheets integration not configured. Please add GOOGLE_SHEETS_ENABLED=true and credentials to .env file."
        }
    
    if not GOOGLE_SHEET_ID:
        return {
            "success": False,
            "message": "GOOGLE_SHEET_ID not set in environment variables"
        }
    
    try:
        # Get all jobs
        jobs = await db.jobs.find({}, {"_id": 0}).to_list(1000)
        
        if not jobs:
            return {
                "success": False,
                "message": "No jobs found to export"
            }
        
        # Initialize Google Sheets client
        client = get_google_sheets_client()
        if not client:
            return {
                "success": False,
                "message": "Failed to initialize Google Sheets client. Check credentials."
            }
        
        # Open the spreadsheet
        try:
            sheet = client.open_by_key(GOOGLE_SHEET_ID)
        except Exception as e:
            return {
                "success": False,
                "message": f"Failed to open Google Sheet. Make sure the Sheet ID is correct and shared with the service account. Error: {str(e)}"
            }
        
        # Get or create worksheet
        try:
            worksheet = sheet.worksheet("ICD Tuning Jobs")
        except Exception:
            worksheet = sheet.add_worksheet(title="ICD Tuning Jobs", rows=1000, cols=20)
        
        # Clear existing data
        worksheet.clear()
        
        # Prepare headers
        headers = [
            "Job ID",
            "Customer Name",
            "Contact Number",
            "Vehicle",
            "Registration No",
            "VIN",
            "Odometer (KMs)",
            "Entry Date",
            "Assigned Mechanic",
            "Work Description",
            "Estimated Delivery",
            "Status",
            "Notes",
            "Completion Date",
            "Created At"
        ]
        
        # Prepare data rows
        data_rows = []
        for job in jobs:
            entry_date = job.get('entry_date')
            if isinstance(entry_date, datetime):
                entry_date = entry_date.strftime('%Y-%m-%d')
            elif isinstance(entry_date, str):
                entry_date = entry_date.split('T')[0]
            
            estimated_delivery = job.get('estimated_delivery')
            if isinstance(estimated_delivery, datetime):
                estimated_delivery = estimated_delivery.strftime('%Y-%m-%d')
            elif isinstance(estimated_delivery, str):
                estimated_delivery = estimated_delivery.split('T')[0]
            
            completion_date = job.get('completion_date', '')
            if completion_date and isinstance(completion_date, datetime):
                completion_date = completion_date.strftime('%Y-%m-%d')
            elif completion_date and isinstance(completion_date, str):
                completion_date = completion_date.split('T')[0]
            
            row = [
                job.get('id', '')[:8],  # Short ID
                job.get('customer_name', ''),
                job.get('contact_number', ''),
                f"{job.get('car_brand', '')} {job.get('car_model', '')} ({job.get('year', '')})",
                job.get('registration_number', ''),
                job.get('vin', ''),
                str(job.get('kms', '')) if job.get('kms') else '',
                entry_date,
                job.get('assigned_mechanic_name', ''),
                job.get('work_description', ''),
                estimated_delivery,
                job.get('status', ''),
                job.get('notes', ''),
                completion_date,
                job.get('created_at', '')
            ]
            data_rows.append(row)
        
        # Update sheet with headers and data
        all_data = [headers] + data_rows
        worksheet.update('A1', all_data)
        
        # Format the header row
        worksheet.format('A1:O1', {
            "backgroundColor": {"red": 0.82, "green": 0.18, "blue": 0.18},  # Red
            "textFormat": {"bold": True, "foregroundColor": {"red": 1, "green": 1, "blue": 1}},
            "horizontalAlignment": "CENTER"
        })
        
        # Auto-resize columns
        worksheet.columns_auto_resize(0, len(headers))
        
        # Add timestamp
        export_time = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
        worksheet.update('A' + str(len(data_rows) + 3), [[f"Exported by: {current_user.full_name} on {export_time}"]])
        
        logging.info(f"Successfully exported {len(jobs)} jobs to Google Sheets by {current_user.full_name}")
        
        return {
            "success": True,
            "message": f"Successfully exported {len(jobs)} jobs to Google Sheets",
            "job_count": len(jobs),
            "sheet_url": f"https://docs.google.com/spreadsheets/d/{GOOGLE_SHEET_ID}"
        }
        
    except Exception as e:
        logging.error(f"Error exporting to Google Sheets: {str(e)}")
        return {
            "success": False,
            "message": f"Failed to export to Google Sheets: {str(e)}"
        }

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()