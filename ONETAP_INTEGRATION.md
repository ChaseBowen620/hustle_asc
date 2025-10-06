# OneTap Checkin Integration Guide

This guide provides everything you need to integrate OneTap checkin with your Hustle ASC system using a single, comprehensive webhook endpoint.

## Webhook Endpoint

**URL:** `POST http://52.8.4.183:8000/api/webhook/onetap/`

**Purpose:** Handle all OneTap operations (student creation, event creation, attendance recording)

**Authentication:** None required (for basic setup)

## Supported Actions

The webhook supports three actions via the `action` field:

1. **`create_student`** - Create new students
2. **`create_event`** - Create new events  
3. **`record_attendance`** - Record student attendance

## Payload Format

### Base Structure
```json
{
    "action": "create_student|create_event|record_attendance",
    "data": {
        // Action-specific data (see below)
    },
    "source": "onetap_checkin",
    "metadata": {
        // Optional additional data
    }
}
```

## Action-Specific Payloads

### 1. Create Student

```json
{
    "action": "create_student",
    "data": {
        "student_identifier": "a12345678",
        "email": "student@example.com",
        "first_name": "John",
        "last_name": "Doe",
        "is_admin": false
    },
    "source": "onetap_checkin"
}
```

**Required Fields:**
- `student_identifier` - A-number or unique identifier
- `email` - Student's email address
- `first_name` - Student's first name
- `last_name` - Student's last name

**Optional Fields:**
- `is_admin` - Boolean, defaults to false

### 2. Create Event

```json
{
    "action": "create_event",
    "data": {
        "event_name": "Weekly Meeting",
        "event_date": "2024-01-15T10:00:00Z",
        "event_type": "Meeting",
        "points": 5,
        "description": "Weekly team meeting"
    },
    "source": "onetap_checkin"
}
```

**Required Fields:**
- `event_name` - Name of the event
- `event_date` - ISO datetime string (e.g., "2024-01-15T10:00:00Z")

**Optional Fields:**
- `event_type` - Type of event, defaults to "General"
- `points` - Points awarded for attendance, defaults to 0
- `description` - Event description

### 3. Record Attendance

```json
{
    "action": "record_attendance",
    "data": {
        "student_identifier": "a12345678",
        "event_identifier": "1",
        "check_in_time": "2024-01-15T10:30:00Z"
    },
    "source": "onetap_checkin"
}
```

**Required Fields:**
- `student_identifier` - A-number or email
- `event_identifier` - Event ID or name

**Optional Fields:**
- `check_in_time` - ISO datetime, defaults to current time

## Response Format

### Success Response (201 Created)
```json
{
    "success": true,
    "message": "Operation completed successfully",
    "student": {
        "id": 123,
        "identifier": "a12345678",
        "name": "John Doe",
        "email": "student@example.com",
        "is_admin": false
    },
    "source": "onetap_checkin"
}
```

### Error Response (4xx/5xx)
```json
{
    "error": "Error description",
    "details": "Additional error details"
}
```

## Integration Examples

### Python Example
```python
import requests
import json
from datetime import datetime

class OneTapIntegration:
    def __init__(self, webhook_url):
        self.webhook_url = webhook_url
    
    def create_student(self, student_id, email, first_name, last_name, is_admin=False):
        payload = {
            "action": "create_student",
            "data": {
                "student_identifier": student_id,
                "email": email,
                "first_name": first_name,
                "last_name": last_name,
                "is_admin": is_admin
            },
            "source": "onetap_checkin"
        }
        return self._send_webhook(payload)
    
    def create_event(self, name, date, event_type="General", points=0, description=""):
        payload = {
            "action": "create_event",
            "data": {
                "event_name": name,
                "event_date": date.isoformat() + "Z",
                "event_type": event_type,
                "points": points,
                "description": description
            },
            "source": "onetap_checkin"
        }
        return self._send_webhook(payload)
    
    def record_attendance(self, student_id, event_id):
        payload = {
            "action": "record_attendance",
            "data": {
                "student_identifier": student_id,
                "event_identifier": event_id
            },
            "source": "onetap_checkin"
        }
        return self._send_webhook(payload)
    
    def _send_webhook(self, payload):
        response = requests.post(
            self.webhook_url,
            json=payload,
            headers={'Content-Type': 'application/json'}
        )
        return response.json()

# Usage
onetap = OneTapIntegration("http://52.8.4.183:8000/api/webhook/onetap/")

# Create a student
result = onetap.create_student("a12345678", "john@example.com", "John", "Doe")
print(result)

# Create an event
result = onetap.create_event("Weekly Meeting", datetime.now(), "Meeting", 5)
print(result)

# Record attendance
result = onetap.record_attendance("a12345678", "1")
print(result)
```

### JavaScript Example
```javascript
class OneTapIntegration {
    constructor(webhookUrl) {
        this.webhookUrl = webhookUrl;
    }
    
    async createStudent(studentId, email, firstName, lastName, isAdmin = false) {
        const payload = {
            action: "create_student",
            data: {
                student_identifier: studentId,
                email: email,
                first_name: firstName,
                last_name: lastName,
                is_admin: isAdmin
            },
            source: "onetap_checkin"
        };
        return await this.sendWebhook(payload);
    }
    
    async createEvent(name, date, eventType = "General", points = 0, description = "") {
        const payload = {
            action: "create_event",
            data: {
                event_name: name,
                event_date: date.toISOString(),
                event_type: eventType,
                points: points,
                description: description
            },
            source: "onetap_checkin"
        };
        return await this.sendWebhook(payload);
    }
    
    async recordAttendance(studentId, eventId) {
        const payload = {
            action: "record_attendance",
            data: {
                student_identifier: studentId,
                event_identifier: eventId
            },
            source: "onetap_checkin"
        };
        return await this.sendWebhook(payload);
    }
    
    async sendWebhook(payload) {
        const response = await fetch(this.webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        return await response.json();
    }
}

// Usage
const onetap = new OneTapIntegration("http://52.8.4.183:8000/api/webhook/onetap/");

// Create a student
onetap.createStudent("a12345678", "john@example.com", "John", "Doe")
    .then(result => console.log(result));

// Create an event
onetap.createEvent("Weekly Meeting", new Date(), "Meeting", 5)
    .then(result => console.log(result));

// Record attendance
onetap.recordAttendance("a12345678", "1")
    .then(result => console.log(result));
```

### cURL Examples

#### Create Student
```bash
curl -X POST http://52.8.4.183:8000/api/webhook/onetap/ \
  -H "Content-Type: application/json" \
  -d '{
    "action": "create_student",
    "data": {
        "student_identifier": "a12345678",
        "email": "john@example.com",
        "first_name": "John",
        "last_name": "Doe",
        "is_admin": false
    },
    "source": "onetap_checkin"
  }'
```

#### Create Event
```bash
curl -X POST http://52.8.4.183:8000/api/webhook/onetap/ \
  -H "Content-Type: application/json" \
  -d '{
    "action": "create_event",
    "data": {
        "event_name": "Weekly Meeting",
        "event_date": "2024-01-15T10:00:00Z",
        "event_type": "Meeting",
        "points": 5,
        "description": "Weekly team meeting"
    },
    "source": "onetap_checkin"
  }'
```

#### Record Attendance
```bash
curl -X POST http://52.8.4.183:8000/api/webhook/onetap/ \
  -H "Content-Type: application/json" \
  -d '{
    "action": "record_attendance",
    "data": {
        "student_identifier": "a12345678",
        "event_identifier": "1"
    },
    "source": "onetap_checkin"
  }'
```

## Testing

### Health Check
```bash
curl http://52.8.4.183:8000/api/webhook/onetap/status/
```

### Test All Actions
```bash
# Test student creation
curl -X POST http://52.8.4.183:8000/api/webhook/onetap/ \
  -H "Content-Type: application/json" \
  -d '{"action": "create_student", "data": {"student_identifier": "test123", "email": "test@example.com", "first_name": "Test", "last_name": "User"}, "source": "test"}'

# Test event creation
curl -X POST http://52.8.4.183:8000/api/webhook/onetap/ \
  -H "Content-Type: application/json" \
  -d '{"action": "create_event", "data": {"event_name": "Test Event", "event_date": "2024-01-15T10:00:00Z"}, "source": "test"}'

# Test attendance recording
curl -X POST http://52.8.4.183:8000/api/webhook/onetap/ \
  -H "Content-Type: application/json" \
  -d '{"action": "record_attendance", "data": {"student_identifier": "test123", "event_identifier": "Test Event"}, "source": "test"}'
```

## Error Handling

### Common Errors

1. **Invalid Action**
   ```json
   {
       "error": "Unknown action: invalid_action. Valid actions are: create_student, create_event, record_attendance"
   }
   ```

2. **Missing Required Fields**
   ```json
   {
       "error": "student_identifier, email, first_name, and last_name are required"
   }
   ```

3. **Student Already Exists**
   ```json
   {
       "error": "Student with email student@example.com already exists"
   }
   ```

4. **Student Not Found (for attendance)**
   ```json
   {
       "error": "Student with identifier a12345678 not found"
   }
   ```

5. **Event Not Found (for attendance)**
   ```json
   {
       "error": "Event with identifier 999 not found"
   }
   ```

6. **Duplicate Attendance**
   ```json
   {
       "error": "Student already checked in to this event"
   }
   ```

## Best Practices

1. **Always check the response** for success/error status
2. **Handle errors gracefully** in your OneTap integration
3. **Implement retry logic** for failed webhook calls
4. **Log all webhook interactions** for debugging
5. **Use consistent student identifiers** across all operations
6. **Validate data** before sending to the webhook
7. **Test with your actual data** before going live

## Monitoring

- Check webhook status: `GET /api/webhook/onetap/status/`
- Monitor Django logs for webhook activity
- Set up alerts for webhook failures
- Track student and event creation success rates

## Security Considerations

- The webhook currently has no authentication (suitable for internal networks)
- For production use, consider implementing HMAC signature verification
- Monitor webhook access logs
- Implement rate limiting if needed

## Support

For issues or questions:
1. Check the webhook status endpoint
2. Review Django application logs
3. Test with the provided curl examples
4. Verify network connectivity
5. Check student and event data in your system

