# ICD Tuning App - Integration Implementation Guide

This guide explains how to implement the three mocked integrations (WhatsApp, Email, Google Sheets) in your ICD Tuning garage management application.

## Table of Contents
1. [WhatsApp Business API Integration](#whatsapp-business-api-integration)
2. [Mailchimp Email Integration](#mailchimp-email-integration)
3. [Google Sheets Integration](#google-sheets-integration)

---

## WhatsApp Business API Integration

### Overview
Currently mocked function: `send_whatsapp_message()` in `/app/backend/server.py`

### Quick Start (Using Baileys - No API Key Required)

**Note:** WhatsApp Business API through Baileys uses your personal WhatsApp account and requires a Node.js service.

#### 1. Create WhatsApp Service (Node.js)

Install dependencies:
```bash
npm install @whiskeysockets/baileys qrcode-terminal express cors axios
```

Create `whatsapp-service.js`:
```javascript
const { makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys')
const express = require('express')
const app = express()
app.use(express.json())

let sock = null

async function initWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info')
    sock = makeWASocket({ auth: state })
    
    sock.ev.on('creds.update', saveCreds)
    sock.ev.on('connection.update', (update) => {
        console.log('Connection status:', update.connection)
    })
}

app.post('/send', async (req, res) => {
    const { phone_number, message } = req.body
    const jid = phone_number.includes('@') ? phone_number : `${phone_number}@s.whatsapp.net`
    
    try {
        await sock.sendMessage(jid, { text: message })
        res.json({ success: true })
    } catch (error) {
        res.status(500).json({ success: false, error: error.message })
    }
})

app.listen(3001, () => {
    console.log('WhatsApp service running on port 3001')
    initWhatsApp()
})
```

#### 2. Update FastAPI Backend

Replace the mocked function in `server.py`:

```python
import httpx

WHATSAPP_SERVICE_URL = "http://localhost:3001"

async def send_whatsapp_message(phone_number: str, message: str):
    """Send WhatsApp message via Baileys service."""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{WHATSAPP_SERVICE_URL}/send",
                json={"phone_number": phone_number, "message": message},
                timeout=10.0
            )
            return response.json()
    except Exception as e:
        logger.error(f"WhatsApp API error: {e}")
        return {"success": False, "error": str(e)}
```

#### 3. First-Time Setup

1. Run the Node.js service: `node whatsapp-service.js`
2. Scan the QR code with WhatsApp (Open WhatsApp → Settings → Linked Devices)
3. Once connected, the service will work automatically

#### Alternative: Official WhatsApp Business API

For production use with high volume:
- Sign up at: https://business.facebook.com/whatsapp
- Get API credentials (requires Facebook Business verification)
- Use the official WhatsApp Cloud API
- Cost: Free for first 1000 messages/month, then paid

---

## Mailchimp Email Integration

### Overview
Currently mocked function: `send_email()` in `/app/backend/server.py`

### Setup Instructions

#### 1. Get Mailchimp Transactional API Key

1. Sign up for Mailchimp at https://mailchimp.com
2. Enable "Transactional Email" (formerly Mandrill) from your account
3. Navigate to Settings → API Keys → Create New Key
4. Copy your API key

#### 2. Install Python Client

```bash
pip install mailchimp-transactional
pip freeze > requirements.txt
```

#### 3. Update Backend Environment

Add to `/app/backend/.env`:
```
MAILCHIMP_API_KEY=your_api_key_here
MAILCHIMP_FROM_EMAIL=noreply@icdtuning.com
MAILCHIMP_FROM_NAME=ICD Tuning
```

#### 4. Replace Mocked Function

Update `server.py`:

```python
import mailchimp_transactional as mandrill
import os

MAILCHIMP_API_KEY = os.environ.get('MAILCHIMP_API_KEY')

def send_email(to_email: str, subject: str, body: str, attachment=None):
    """Send email via Mailchimp Transactional."""
    try:
        client = mandrill.Mandrill(MAILCHIMP_API_KEY)
        
        message = {
            "from_email": os.environ.get('MAILCHIMP_FROM_EMAIL'),
            "from_name": os.environ.get('MAILCHIMP_FROM_NAME'),
            "subject": subject,
            "html": body,
            "text": body.replace("<", "").replace(">", ""),  # Simple text version
            "to": [{"email": to_email, "type": "to"}]
        }
        
        # Add attachment if provided (for PDF invoices)
        if attachment:
            import base64
            with open(attachment, "rb") as f:
                content = base64.b64encode(f.read()).decode()
            
            message["attachments"] = [{
                "type": "application/pdf",
                "name": os.path.basename(attachment),
                "content": content
            }]
        
        result = client.messages.send(message=message)
        logger.info(f"Email sent successfully: {result}")
        return {"success": True, "message": "Email sent"}
        
    except Exception as e:
        logger.error(f"Email error: {e}")
        return {"success": False, "error": str(e)}
```

#### 5. Domain Authentication (Important!)

To ensure emails don't go to spam:
1. Go to Mailchimp Transactional → Settings → Sending Domains
2. Add your domain (e.g., icdtuning.com)
3. Add the provided DNS records to your domain:
   - Two CNAME records for DKIM
   - One TXT record for verification

---

## Google Sheets Integration

### Overview
Currently mocked function: `export_to_google_sheets()` in `/app/backend/server.py`

### Setup Instructions

#### 1. Create Google Cloud Project & Service Account

1. Go to https://console.cloud.google.com
2. Create a new project (or select existing)
3. Enable APIs:
   - Go to "APIs & Services" → "Library"
   - Search and enable "Google Sheets API"
   - Search and enable "Google Drive API"

4. Create Service Account:
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "Service Account"
   - Name it "icd-sheets-integration"
   - Click "Create and Continue"
   - Skip role assignment (or assign "Editor")
   - Click "Done"

5. Download Credentials:
   - Click on the created service account
   - Go to "Keys" tab
   - Click "Add Key" → "Create new key"
   - Select "JSON" and click "Create"
   - Save the downloaded JSON file securely

#### 2. Install Python Libraries

```bash
pip install gspread google-auth-httplib2 google-auth-oauthlib apscheduler
pip freeze > requirements.txt
```

#### 3. Setup Environment

Add to `/app/backend/.env`:
```
GOOGLE_CREDENTIALS_PATH=/path/to/service-account-key.json
GOOGLE_SHEET_ID=your_spreadsheet_id_here
```

**Important:** Add the JSON file to `.gitignore`:
```
echo "service-account-*.json" >> .gitignore
```

#### 4. Create Google Sheets Module

Create `/app/backend/sheets_service.py`:

```python
import gspread
from google.oauth2.service_account import Credentials
from datetime import datetime
import os

SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive'
]

class SheetsManager:
    def __init__(self):
        creds_path = os.environ.get('GOOGLE_CREDENTIALS_PATH')
        creds = Credentials.from_service_account_file(creds_path, scopes=SCOPES)
        self.client = gspread.authorize(creds)
    
    def export_jobs_to_sheet(self, jobs: list):
        """Export job data to Google Sheets."""
        try:
            sheet_id = os.environ.get('GOOGLE_SHEET_ID')
            
            # Open the spreadsheet
            spreadsheet = self.client.open_by_key(sheet_id)
            
            # Get or create worksheet with today's date
            today = datetime.now().strftime("%Y-%m-%d")
            worksheet_name = f"Jobs {today}"
            
            try:
                worksheet = spreadsheet.worksheet(worksheet_name)
            except gspread.WorksheetNotFound:
                worksheet = spreadsheet.add_worksheet(
                    title=worksheet_name,
                    rows=1000,
                    cols=10
                )
            
            # Clear existing data
            worksheet.clear()
            
            # Add headers
            headers = [
                'Job ID', 'Customer Name', 'Car', 'Reg Number',
                'Status', 'Entry Date', 'Completion Date', 'Mechanic'
            ]
            worksheet.append_row(headers)
            
            # Format header row
            worksheet.format('A1:H1', {
                'textFormat': {'bold': True},
                'backgroundColor': {'red': 0.83, 'green': 0.18, 'blue': 0.18}
            })
            
            # Add job data
            for job in jobs:
                row = [
                    job['id'],
                    job['customer_name'],
                    f"{job['car_brand']} {job['car_model']}",
                    job['registration_number'],
                    job['status'],
                    job['entry_date'],
                    job.get('completion_date', 'N/A'),
                    job['assigned_mechanic_name']
                ]
                worksheet.append_row(row)
            
            return {"success": True, "rows_exported": len(jobs)}
            
        except Exception as e:
            logger.error(f"Google Sheets export error: {e}")
            return {"success": False, "error": str(e)}

# Initialize globally
sheets_manager = None

def initialize_sheets_manager():
    global sheets_manager
    sheets_manager = SheetsManager()

def export_to_google_sheets(jobs: list):
    """Export completed jobs to Google Sheets."""
    if sheets_manager is None:
        initialize_sheets_manager()
    
    return sheets_manager.export_jobs_to_sheet(jobs)
```

#### 5. Update server.py

Add to startup:
```python
from sheets_service import initialize_sheets_manager, export_to_google_sheets

@app.on_event("startup")
async def startup_event():
    initialize_sheets_manager()
```

Replace the mocked function with the import.

#### 6. Create Spreadsheet & Share with Service Account

1. Create a new Google Sheet manually at https://sheets.google.com
2. Copy the spreadsheet ID from URL: 
   `https://docs.google.com/spreadsheets/d/SPREADSHEET_ID_HERE/edit`
3. Click "Share" button
4. Add your service account email (found in the JSON file as `client_email`)
5. Give it "Editor" permissions
6. Update `GOOGLE_SHEET_ID` in your `.env` file

#### 7. Schedule Daily Exports (Optional)

Add to `server.py`:

```python
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

scheduler = BackgroundScheduler()

async def daily_export_task():
    """Export completed jobs daily at 2 AM."""
    jobs = await db.jobs.find({"status": "Done"}, {"_id": 0}).to_list(1000)
    result = export_to_google_sheets(jobs)
    logger.info(f"Daily export result: {result}")

@app.on_event("startup")
async def startup_event():
    initialize_sheets_manager()
    
    # Schedule daily export at 2:00 AM
    scheduler.add_job(
        daily_export_task,
        CronTrigger(hour=2, minute=0),
        id='daily_job_export'
    )
    scheduler.start()
    logger.info("Scheduler started for daily exports")

@app.on_event("shutdown")
async def shutdown_event():
    scheduler.shutdown()
```

---

## Testing Your Integrations

### WhatsApp Test
```bash
curl -X POST "http://localhost:8000/api/jobs/JOB_ID/send-confirmation"
```

### Email Test
```bash
curl -X POST "http://localhost:8000/api/invoices/INVOICE_ID/send" \
  -H "Content-Type: application/json" \
  -d '{"send_type": "accountant"}'
```

### Google Sheets Test
```bash
curl -X POST "http://localhost:8000/api/export/google-sheets"
```

---

## Security Best Practices

1. **Never commit credentials to Git**
   - Add `.env` files to `.gitignore`
   - Add `*.json` credential files to `.gitignore`

2. **Use environment variables**
   - All API keys should be in `.env` file
   - Never hardcode sensitive data

3. **Rotate API keys regularly**
   - Change keys every 90 days
   - Revoke old keys immediately if compromised

4. **Use service accounts for Google Sheets**
   - Don't use personal OAuth for server applications
   - Service accounts are more secure and don't require user interaction

---

## Troubleshooting

### WhatsApp Issues
- **QR Code not appearing**: Restart Node.js service
- **Message not sending**: Check phone number format (+91XXXXXXXXXX)
- **Connection lost**: Re-scan QR code

### Email Issues
- **Emails going to spam**: Complete domain authentication
- **API key invalid**: Regenerate key in Mailchimp dashboard
- **Attachment too large**: Limit to 25MB total message size

### Google Sheets Issues
- **Permission denied**: Ensure spreadsheet is shared with service account email
- **Quota exceeded**: You have 300 reads/60 writes per minute limit
- **Worksheet not found**: Check worksheet name matches exactly

---

## Cost Estimates

### WhatsApp (Baileys Method)
- **Free** - Uses your personal WhatsApp account
- Limitation: May violate WhatsApp ToS for business use
- Alternative: Official WhatsApp Business API (~$0.005-0.09 per message)

### Mailchimp Transactional
- **500 free emails** for new accounts
- Then: $20/month for 25,000 emails
- Invoice PDFs count as attachments

### Google Sheets API
- **Free** - No cost for API usage
- Only Google Workspace cost if you need it

---

## Need Help?

For detailed implementation guides, see the full playbooks provided by the integration expert:
- WhatsApp: Check Baileys documentation
- Mailchimp: https://mailchimp.com/developer/transactional/
- Google Sheets: https://developers.google.com/sheets/api

For issues specific to your implementation, check the logs:
```bash
tail -f /var/log/supervisor/backend.err.log
```
