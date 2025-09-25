# Attendance Webhook Integration Guide

This guide explains how to integrate external attendance applications with your Hustle ASC system using webhooks.

## Webhook Endpoints

### 1. Unified Webhook (Recommended)
**URL:** `POST http://your-server:8000/api/webhook/unified/`

**Purpose:** Handle students, events, and attendances in a single endpoint

**Authentication:** None required (for basic setup)

**Features:**
- Automatically detects operation type based on payload structure
- Supports student creation/updates
- Supports event creation/updates  
- Supports attendance recording
- Comprehensive error handling and logging

### 2. Basic Attendance Webhook
**URL:** `POST http://your-server:8000/api/webhook/attendance/`

**Purpose:** Record student attendance for events

**Authentication:** None required (for basic setup)

### 3. Secure Attendance Webhook
**URL:** `POST http://your-server:8000/api/webhook/attendance/secure/`

**Purpose:** Same as basic webhook but with HMAC signature verification

**Authentication:** Requires `X-Webhook-Signature` header with HMAC-SHA256 signature

### 4. OneTap Webhook
**URL:** `POST http://your-server:8000/api/webhook/onetap/`

**Purpose:** Comprehensive webhook for OneTap integration

**Authentication:** None required (for basic setup)

### 5. Webhook Status Check
**URL:** `GET http://your-server:8000/api/webhook/status/`

**Purpose:** Health check endpoint to verify webhook availability

## Payload Format

### Unified Webhook Payload Format

The unified webhook automatically detects the operation type based on the `type` field in the payload.

#### Student Operations
```json
{
    "type": "student",
    "action": "create",                          // Required: "create" or "update"
    "data": {
        "student_identifier": "a12345678",       // Required: A-number
        "email": "student@usu.edu",              // Required: Student email
        "first_name": "John",                    // Required: First name
        "last_name": "Doe",                      // Required: Last name
        "is_admin": false                        // Optional: Admin status (default: false)
    },
    "source": "external_app_name",               // Optional: Source identifier
    "metadata": {}                               // Optional: Additional data
}
```

#### Event Operations
```json
{
    "type": "event",
    "action": "create",                          // Required: "create" or "update"
    "data": {
        "event_name": "Weekly Meeting",          // Required: Event name
        "event_date": "2024-01-15T10:00:00Z",   // Required: ISO datetime
        "event_type": "Meeting",                 // Optional: Event type (default: "General")
        "points": 5,                             // Optional: Points (default: 0)
        "description": "Weekly team meeting",    // Optional: Description
        "location": "Room 101"                   // Optional: Location
    },
    "source": "external_app_name",               // Optional: Source identifier
    "metadata": {}                               // Optional: Additional data
}
```

#### Attendance Operations
```json
{
    "type": "attendance",
    "action": "create",                          // Required: "create"
    "data": {
        "student_identifier": "a12345678",       // Required: A-number or email
        "event_identifier": "1",                 // Required: Event ID or name
        "check_in_time": "2024-01-15T10:30:00Z" // Optional: ISO datetime
    },
    "source": "external_app_name",               // Optional: Source identifier
    "metadata": {}                               // Optional: Additional data
}
```

### Legacy Attendance Webhook Payload Format

For backward compatibility, the basic attendance webhook still supports the original format:

```json
{
    "student_identifier": "a12345678",           // Required: A-number or email
    "event_identifier": "1",                     // Required: Event ID or name
    "check_in_time": "2024-01-15T10:30:00Z",    // Optional: ISO datetime
    "source": "external_app_name",               // Optional: Source identifier
    "metadata": {                                // Optional: Additional data
        "device": "scanner_001",
        "location": "main_entrance"
    }
}
```

### Response Format

#### Success Response (201 Created)
```json
{
    "success": true,
    "message": "Attendance recorded successfully",
    "attendance_id": 123,
    "student": {
        "id": 456,
        "name": "John Doe",
        "email": "john.doe@example.com"
    },
    "event": {
        "id": 1,
        "name": "Weekly Meeting",
        "date": "2024-01-15"
    },
    "checked_in_at": "2024-01-15T10:30:00Z",
    "source": "external_app"
}
```

#### Error Response (4xx/5xx)
```json
{
    "error": "Error description",
    "details": "Additional error details"
}
```

## Student Identification

The webhook supports multiple ways to identify students:

1. **A-Number:** `"a12345678"` (username format)
2. **Email:** `"student@example.com"`

## Event Identification

Events can be identified by:

1. **Event ID:** `"1"` (numeric ID)
2. **Event Name:** `"Weekly Meeting"` (exact name match)

## Security Setup (Optional)

For production use, enable secure webhook with HMAC verification:

1. **Set webhook secret in Django settings:**
   ```python
   WEBHOOK_SECRET = "your-secret-key-here"
   ```

2. **Generate HMAC signature in your app:**
   ```python
   import hmac
   import hashlib
   
   def generate_signature(payload, secret):
       return hmac.new(
           secret.encode('utf-8'),
           payload.encode('utf-8'),
           hashlib.sha256
       ).hexdigest()
   ```

3. **Include signature in request headers:**
   ```
   X-Webhook-Signature: sha256=generated_signature
   ```

## Integration Examples

### Unified Webhook Examples

#### Python Example - Complete Integration
```python
import requests
import json
from datetime import datetime

class HustleWebhookClient:
    def __init__(self, base_url="http://your-server:8000/api/webhook/unified/"):
        self.base_url = base_url
    
    def create_student(self, student_id, email, first_name, last_name, is_admin=False):
        """Create a new student."""
        payload = {
            "type": "student",
            "action": "create",
            "data": {
                "student_identifier": student_id,
                "email": email,
                "first_name": first_name,
                "last_name": last_name,
                "is_admin": is_admin
            },
            "source": "python_client"
        }
        return requests.post(self.base_url, json=payload).json()
    
    def create_event(self, name, date, event_type="General", points=0, description="", location=""):
        """Create a new event."""
        payload = {
            "type": "event",
            "action": "create",
            "data": {
                "event_name": name,
                "event_date": date.isoformat() + "Z",
                "event_type": event_type,
                "points": points,
                "description": description,
                "location": location
            },
            "source": "python_client"
        }
        return requests.post(self.base_url, json=payload).json()
    
    def record_attendance(self, student_id, event_id):
        """Record student attendance."""
        payload = {
            "type": "attendance",
            "action": "create",
            "data": {
                "student_identifier": student_id,
                "event_identifier": event_id
            },
            "source": "python_client"
        }
        return requests.post(self.base_url, json=payload).json()

# Usage example
client = HustleWebhookClient()

# Create a student
student_result = client.create_student(
    "a12345678", 
    "john.doe@usu.edu", 
    "John", 
    "Doe"
)

# Create an event
event_result = client.create_event(
    "Weekly Meeting",
    datetime.now(),
    "Meeting",
    5,
    "Weekly team meeting",
    "Room 101"
)

# Record attendance
attendance_result = client.record_attendance("a12345678", "Weekly Meeting")
```

#### JavaScript Example - Complete Integration
```javascript
class HustleWebhookClient {
    constructor(baseUrl = 'http://your-server:8000/api/webhook/unified/') {
        this.baseUrl = baseUrl;
    }
    
    async createStudent(studentId, email, firstName, lastName, isAdmin = false) {
        const payload = {
            type: 'student',
            action: 'create',
            data: {
                student_identifier: studentId,
                email: email,
                first_name: firstName,
                last_name: lastName,
                is_admin: isAdmin
            },
            source: 'javascript_client'
        };
        
        const response = await fetch(this.baseUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        return await response.json();
    }
    
    async createEvent(name, date, eventType = 'General', points = 0, description = '', location = '') {
        const payload = {
            type: 'event',
            action: 'create',
            data: {
                event_name: name,
                event_date: date.toISOString(),
                event_type: eventType,
                points: points,
                description: description,
                location: location
            },
            source: 'javascript_client'
        };
        
        const response = await fetch(this.baseUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        return await response.json();
    }
    
    async recordAttendance(studentId, eventId) {
        const payload = {
            type: 'attendance',
            action: 'create',
            data: {
                student_identifier: studentId,
                event_identifier: eventId
            },
            source: 'javascript_client'
        };
        
        const response = await fetch(this.baseUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        return await response.json();
    }
}

// Usage example
const client = new HustleWebhookClient();

// Create a student
const studentResult = await client.createStudent(
    'a12345678', 
    'john.doe@usu.edu', 
    'John', 
    'Doe'
);

// Create an event
const eventResult = await client.createEvent(
    'Weekly Meeting',
    new Date(),
    'Meeting',
    5,
    'Weekly team meeting',
    'Room 101'
);

// Record attendance
const attendanceResult = await client.recordAttendance('a12345678', 'Weekly Meeting');
```

### Legacy Attendance Webhook Examples

#### Python Example - Legacy Format
```python
import requests
import json

def record_attendance(student_id, event_id):
    url = "http://your-server:8000/api/webhook/attendance/"
    payload = {
        "student_identifier": student_id,
        "event_identifier": event_id,
        "source": "my_attendance_app"
    }
    
    response = requests.post(url, json=payload)
    return response.json()
```

### JavaScript Example
```javascript
async function recordAttendance(studentId, eventId) {
    const url = 'http://your-server:8000/api/webhook/attendance/';
    const payload = {
        student_identifier: studentId,
        event_identifier: eventId,
        source: 'my_attendance_app'
    };
    
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });
    
    return await response.json();
}
```

### cURL Examples

#### Unified Webhook - Create Student
```bash
curl -X POST http://your-server:8000/api/webhook/unified/ \
  -H "Content-Type: application/json" \
  -d '{
    "type": "student",
    "action": "create",
    "data": {
      "student_identifier": "a12345678",
      "email": "john.doe@usu.edu",
      "first_name": "John",
      "last_name": "Doe",
      "is_admin": false
    },
    "source": "curl_test"
  }'
```

#### Unified Webhook - Create Event
```bash
curl -X POST http://your-server:8000/api/webhook/unified/ \
  -H "Content-Type: application/json" \
  -d '{
    "type": "event",
    "action": "create",
    "data": {
      "event_name": "Weekly Meeting",
      "event_date": "2024-01-15T10:00:00Z",
      "event_type": "Meeting",
      "points": 5,
      "description": "Weekly team meeting",
      "location": "Room 101"
    },
    "source": "curl_test"
  }'
```

#### Unified Webhook - Record Attendance
```bash
curl -X POST http://your-server:8000/api/webhook/unified/ \
  -H "Content-Type: application/json" \
  -d '{
    "type": "attendance",
    "action": "create",
    "data": {
      "student_identifier": "a12345678",
      "event_identifier": "Weekly Meeting"
    },
    "source": "curl_test"
  }'
```

#### Legacy Attendance Webhook
```bash
curl -X POST http://your-server:8000/api/webhook/attendance/ \
  -H "Content-Type: application/json" \
  -d '{
    "student_identifier": "a12345678",
    "event_identifier": "1",
    "source": "scanner_app"
  }'
```

## Error Handling

### Common Error Scenarios

1. **Student Not Found (404)**
   ```json
   {
       "error": "Student with identifier a12345678 not found"
   }
   ```

2. **Event Not Found (404)**
   ```json
   {
       "error": "Event with identifier 999 not found"
   }
   ```

3. **Duplicate Attendance (400)**
   ```json
   {
       "error": "Student already checked in to this event"
   }
   ```

4. **Invalid Payload (400)**
   ```json
   {
       "error": "student_identifier and event_identifier are required"
   }
   ```

## Testing

### Unified Webhook Testing

Use the provided test script to verify your unified webhook integration:

```bash
cd /home/ubuntu/hustle_asc
python3 test_unified_webhook.py
```

This test script will:
- Check webhook status
- Test student creation
- Test event creation
- Test attendance recording
- Test error handling with invalid payloads

### Legacy Webhook Testing

For testing the legacy attendance webhook:

```bash
cd /home/ubuntu/hustle_asc
python3 webhook_test_example.py
```

### Manual Testing

You can also test the webhook status endpoint directly:

```bash
curl http://your-server:8000/api/webhook/unified/status/
```

## Monitoring

- Check webhook status: `GET /api/webhook/status/`
- Monitor Django logs for webhook activity
- Set up alerts for webhook failures

## Best Practices

1. **Always handle errors gracefully** in your attendance app
2. **Implement retry logic** for failed webhook calls
3. **Use HTTPS in production** for secure communication
4. **Implement webhook signature verification** for security
5. **Log all webhook interactions** for debugging
6. **Test with your actual data** before going live

## Support

For issues or questions about webhook integration, check:
- Django application logs
- Webhook status endpoint
- Network connectivity between systems
